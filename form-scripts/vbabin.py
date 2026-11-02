"""Build a vbaProject.bin from VBA source (MS-OVBA), with no Excel required.
_VBA_PROJECT uses version 0xFFFF, so Excel ignores the (absent) p-code cache and compiles from source.
"""
import os, random, shutil, struct, subprocess, sys, tempfile, uuid

CP = 'cp1252'


# ---------- MS-OVBA 2.4.1 compression ----------
def _compress_chunk(data: bytes) -> bytes:
    out = bytearray()
    p, n = 0, len(data)
    while p < n:
        flag_pos = len(out)
        out.append(0)
        flags = 0
        for bit in range(8):
            if p >= n:
                break
            # copy-token bit allocation depends on position within chunk
            diff = p
            bit_count = 4
            while (1 << bit_count) < diff:
                bit_count += 1
            bit_count = max(bit_count, 4)
            length_mask = 0xFFFF >> bit_count
            max_len = length_mask + 3
            best_len, best_off = 0, 0
            start = max(0, p - (1 << bit_count))
            for cand in range(p - 1, start - 1, -1):
                l = 0
                while p + l < n and l < max_len and data[cand + l] == data[p + l]:
                    l += 1
                if l > best_len:
                    best_len, best_off = l, p - cand
                    if l == max_len:
                        break
            if best_len >= 3:
                token = ((best_off - 1) << (16 - bit_count)) | (best_len - 3)
                out += struct.pack('<H', token)
                flags |= 1 << bit
                p += best_len
            else:
                out.append(data[p])
                p += 1
        out[flag_pos] = flags
    if len(out) > 4096:  # incompressible: raw chunk (only valid for full 4096-byte chunks)
        assert len(data) == 4096
        return struct.pack('<H', (4096 - 1) & 0x0FFF | 0x3000) + data
    return struct.pack('<H', ((len(out) + 2 - 3) & 0x0FFF) | 0x3000 | 0x8000) + bytes(out)


def compress(data: bytes) -> bytes:
    out = bytearray(b'\x01')
    for i in range(0, len(data), 4096):
        out += _compress_chunk(data[i:i + 4096])
    return bytes(out)


# ---------- dir stream records ----------
def rec(rid, payload=b''):
    return struct.pack('<HI', rid, len(payload)) + payload

def u16(s):
    return s.encode('utf-16-le')

def dir_stream(modules):
    d = bytearray()
    d += rec(0x0001, struct.pack('<I', 1))            # SYSKIND win32
    d += rec(0x0002, struct.pack('<I', 0x0409))       # LCID
    d += rec(0x0014, struct.pack('<I', 0x0409))       # LCIDINVOKE
    d += rec(0x0003, struct.pack('<H', 1252))         # CODEPAGE
    d += rec(0x0004, b'VBAProject')                   # NAME
    d += rec(0x0005) + rec(0x0040)                    # DOCSTRING
    d += rec(0x0006) + rec(0x003D)                    # HELPFILEPATH
    d += rec(0x0007, struct.pack('<I', 0))            # HELPCONTEXT
    d += rec(0x0008, struct.pack('<I', 0))            # LIBFLAGS
    d += struct.pack('<HIIH', 0x0009, 4, 1, 0)        # VERSION (Reserved=4, major, minor)
    d += rec(0x000C) + rec(0x003C)                    # CONSTANTS
    # reference: stdole
    name = 'stdole'
    libid = b'*\\G{00020430-0000-0000-C000-000000000046}#2.0#0#C:\\Windows\\System32\\stdole2.tlb#OLE Automation'
    d += rec(0x0016, name.encode(CP)) + rec(0x003E, u16(name))
    d += rec(0x000D, struct.pack('<I', len(libid)) + libid + struct.pack('<IH', 0, 0))
    # modules
    d += rec(0x000F, struct.pack('<H', len(modules)))
    d += rec(0x0013, struct.pack('<H', 0xFFFF))
    for m in modules:
        nm = m['name']
        d += rec(0x0019, nm.encode(CP)) + rec(0x0047, u16(nm))
        d += rec(0x001A, nm.encode(CP)) + rec(0x0032, u16(nm))
        d += rec(0x001C) + rec(0x0048)
        d += rec(0x0031, struct.pack('<I', 0))        # MODULEOFFSET: source starts at 0
        d += rec(0x001E, struct.pack('<I', 0))
        d += rec(0x002C, struct.pack('<H', 0xFFFF))
        d += struct.pack('<HI', 0x0021 if m['type'] == 'std' else 0x0022, 0)
        d += struct.pack('<HI', 0x002B, 0)
    d += struct.pack('<HI', 0x0010, 0)
    return bytes(d)


# ---------- MS-OVBA 2.4.3 data encryption (CMG / DPB / GC) ----------
def encrypt(data: bytes, project_id: str) -> str:
    seed = random.randint(0, 255)
    version = 2
    proj_key = sum(project_id.encode(CP)) & 0xFF
    out = bytearray([seed, seed ^ version, seed ^ proj_key])
    unenc1, enc1, enc2 = proj_key, seed ^ proj_key, seed ^ version
    def push(b):
        nonlocal unenc1, enc1, enc2
        e = b ^ ((enc2 + unenc1) & 0xFF)
        out.append(e)
        enc2, enc1, unenc1 = enc1, e, b
    for _ in range((seed & 6) // 2):
        push(random.randint(0, 255))
    for b in struct.pack('<I', len(data)) + data:
        push(b)
    return out.hex().upper()


def project_stream(modules, project_id):
    lines = [f'ID="{project_id}"']
    for m in modules:
        lines.append(f'Document={m["name"]}/&H00000000' if m['type'] == 'doc' else f'Module={m["name"]}')
    lines += ['Name="VBAProject"', 'HelpContextID="0"', 'VersionCompatible32="393222000"',
              f'CMG="{encrypt(struct.pack("<I", 0), project_id)}"',
              f'DPB="{encrypt(b"\x00", project_id)}"',
              f'GC="{encrypt(b"\xff", project_id)}"',
              '', '[Host Extender Info]',
              '&H00000001={3832D640-CF90-11CF-8E43-00A0C911005A};VBE;&H00000000',
              '', '[Workspace]']
    lines += [f'{m["name"]}=0, 0, 0, 0, C' for m in modules]
    return ('\r\n'.join(lines) + '\r\n').encode(CP)


def projectwm_stream(modules):
    out = bytearray()
    for m in modules:
        out += m['name'].encode(CP) + b'\x00' + u16(m['name']) + b'\x00\x00'
    return bytes(out + b'\x00\x00')


DOC_ATTRS = {
    'workbook': '0{00020819-0000-0000-C000-000000000046}',
    'sheet': '0{00020820-0000-0000-C000-000000000046}',
}

def doc_source(name, kind, body=''):
    return (f'Attribute VB_Name = "{name}"\r\n'
            f'Attribute VB_Base = "{DOC_ATTRS[kind]}"\r\n'
            'Attribute VB_GlobalNameSpace = False\r\nAttribute VB_Creatable = False\r\n'
            'Attribute VB_PredeclaredId = True\r\nAttribute VB_Exposed = True\r\n'
            'Attribute VB_TemplateDerived = False\r\nAttribute VB_Customizable = True\r\n' + body)


def build(modules, out_path, python=sys.executable):
    """modules: list of dicts {name, type: 'std'|'doc', source}"""
    project_id = '{' + str(uuid.uuid4()).upper() + '}'
    tmp = tempfile.mkdtemp()
    os.mkdir(os.path.join(tmp, 'VBA'))
    def w(rel, data):
        with open(os.path.join(tmp, rel), 'wb') as fh:
            fh.write(data)
    w('VBA/_VBA_PROJECT', struct.pack('<HHBH', 0x61CC, 0xFFFF, 0x00, 0x0000))
    w('VBA/dir', compress(dir_stream(modules)))
    for m in modules:
        src = m['source'].replace('\r\n', '\n').replace('\n', '\r\n')
        w('VBA/' + m['name'], compress(src.encode(CP)))
    w('PROJECT', project_stream(modules, project_id))
    w('PROJECTwm', projectwm_stream(modules))
    subprocess.run([python, '-m', 'ms_cfb', tmp, '-c', '-f', out_path], check=True)
    shutil.rmtree(tmp)
