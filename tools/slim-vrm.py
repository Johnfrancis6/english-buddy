"""Rewrite a VRM (GLB) with smaller textures: max side 1024 (normal maps 512),
WebP via EXT_texture_webp, tiny thumbnail. Geometry and VRM data untouched."""
import json, struct, sys, io
from PIL import Image
src, dst = sys.argv[1], sys.argv[2]
MAX = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
bin_start = 20 + jl + 8
binlen = struct.unpack('<I', b[20 + jl:24 + jl])[0]
binary = b[bin_start:bin_start + binlen]
thumb = None
vrm0 = j.get('extensions', {}).get('VRM')
if vrm0:
    t = vrm0.get('meta', {}).get('texture')
    if t is not None and t >= 0:
        thumb = j['textures'][t]['source']
image_bytes = {}
for i, im in enumerate(j['images']):
    bv = j['bufferViews'][im['bufferView']]
    data = binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    p = Image.open(io.BytesIO(data)); p.load()
    name = (im.get('name') or '').lower()
    limit = 128 if i == thumb else (512 if ('nml' in name or 'normal' in name or 'matcap' in name) else MAX)
    if max(p.size) > limit:
        s = limit / max(p.size)
        p = p.resize((max(1, round(p.size[0] * s)), max(1, round(p.size[1] * s))), Image.LANCZOS)
    has_alpha = 'A' in p.getbands() and p.getchannel('A').getextrema()[0] < 255
    out = io.BytesIO()
    if 'nml' in name:
        p.convert('RGB').save(out, 'WEBP', lossless=False, quality=92, method=6)
    else:
        p = p.convert('RGBA' if has_alpha else 'RGB')
        p.save(out, 'WEBP', quality=88, method=6, alpha_quality=95)
    image_bytes[i] = out.getvalue()
    im['mimeType'] = 'image/webp'
# Rebuild the binary buffer: copy every non-image view, then the new images.
image_views = {im['bufferView']: i for i, im in enumerate(j['images'])}
new = bytearray()
for vi, bv in enumerate(j['bufferViews']):
    while len(new) % 4: new.append(0)
    if vi in image_views:
        data = image_bytes[image_views[vi]]
    else:
        data = binary[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']]
    bv['byteOffset'] = len(new); bv['byteLength'] = len(data); bv['buffer'] = 0
    new += data
while len(new) % 4: new.append(0)
j['buffers'] = [{'byteLength': len(new)}]
for t in j.get('textures', []):
    if 'source' in t:
        t.setdefault('extensions', {})['EXT_texture_webp'] = {'source': t.pop('source')}
for key in ('extensionsUsed', 'extensionsRequired'):
    lst = j.setdefault(key, [])
    if 'EXT_texture_webp' not in lst: lst.append('EXT_texture_webp')
js = json.dumps(j, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
total = 12 + 8 + len(js) + 8 + len(new)
with open(dst, 'wb') as o:
    o.write(struct.pack('<4sII', b'glTF', 2, total))
    o.write(struct.pack('<I4s', len(js), b'JSON')); o.write(js)
    o.write(struct.pack('<I4s', len(new), b'BIN\x00')); o.write(new)
print(dst, f'{len(b)/1e6:.1f} MB -> {total/1e6:.1f} MB')
