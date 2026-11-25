# 食物圖示表（5×4，純白背景）→ 每格去背 → assets/food/{ID}.webp
# 用法：python3 -I tools/foodsheet.py <整張表.png> <輸出資料夾>
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage
IDS = ['F01','F02','F03','F04','F05','F06','F07','F08','F09','F10','F11','F12','F13','F14','F15','F16','T01','T02','T03','T04']
def cut(im):
    rgb = np.asarray(im.convert('RGB')).astype(np.int16); mn, mx = rgb.min(2), rgb.max(2)
    lab, _ = ndimage.label((mn > 232) & (mx - mn < 22))
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(border))
    lab2, n2 = ndimage.label(fg); sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
    fg = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * .08])   # 葵花子這種多顆的要全部留
    fg = ndimage.binary_fill_holes(fg)
    alpha = fg.astype(np.float32)
    edge = fg & ~ndimage.binary_erosion(fg, iterations=2)
    dark = np.clip((255 - mn) / 90., 0, 1); alpha[edge] = dark[edge]
    alpha = np.clip(ndimage.gaussian_filter(alpha, .6), 0, 1); alpha[ndimage.binary_erosion(fg, iterations=2)] = 1
    a = np.clip(alpha, 1e-3, 1)[..., None]
    out = np.clip((rgb.astype(np.float32) - (1 - a) * 255) / a, 0, 255).astype(np.uint8)
    ys, xs = np.nonzero(alpha > .05)
    return Image.fromarray(np.dstack([out, (alpha * 255).astype(np.uint8)])[ys.min():ys.max()+1, xs.min():xs.max()+1], 'RGBA')
if __name__ == '__main__':
    sheet = Image.open(sys.argv[1]).convert('RGB'); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    rgb = np.asarray(sheet).astype(np.int16); mn, mx = rgb.min(2), rgb.max(2)
    fg = ~((mn > 232) & (mx - mn < 22)); lab, n = ndimage.label(ndimage.binary_closing(fg, iterations=2))
    W, H = sheet.size; cw, ch = W / 5, H / 4
    boxes = {}
    for sl, i in zip(ndimage.find_objects(lab), range(1, n + 1)):
        if (lab[sl] == i).sum() < 30: continue
        cy, cx = ndimage.center_of_mass(lab == i); cell = int(cy // ch) * 5 + int(cx // cw)
        y0, y1, x0, x1 = sl[0].start, sl[0].stop, sl[1].start, sl[1].stop
        b0 = boxes.get(cell); boxes[cell] = (min(y0, b0[0]), max(y1, b0[1]), min(x0, b0[2]), max(x1, b0[3])) if b0 else (y0, y1, x0, x1)
    for i, fid in enumerate(IDS):   # 依每個圖示實際範圍裁切（不被格子切到），外圍留 6px
        y0, y1, x0, x1 = boxes[i]
        spr = cut(sheet.crop((max(0, x0 - 6), max(0, y0 - 6), min(W, x1 + 6), min(H, y1 + 6))))
        k = 128 / max(spr.size)
        spr.resize((round(spr.width*k), round(spr.height*k)), Image.LANCZOS).save(f'{out}/{fid}.webp', 'WEBP', quality=90, method=6)
        print(fid, spr.size)
