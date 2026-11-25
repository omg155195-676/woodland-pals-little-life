# ChatGPT 圖（純白背景）→ 去背 → 遊戲用 webp
# 用法：python3 -I tools/cutout.py <輸出資料夾> <基準高度px> <名稱>=<來源圖> [<名稱>=<來源圖> ...]
# 第一張當基準（通常是 idle）：縮放到基準高度；其他張用同一個縮放比例，讓不同動作的大小一致。
# 來源圖是 ChatGPT 大圖檢視的截圖（800×891），圖片區域固定在 (56,68)–(744,756)。
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage

def cutout(path, crop=(56, 68, 744, 756)):
    im = Image.open(path).convert('RGB')
    if crop and im.size == (800, 891): im = im.crop(crop)
    rgb = np.asarray(im).astype(np.int16); mn, mx = rgb.min(2), rgb.max(2)
    bgish = (mn > 232) & (mx - mn < 22)
    lab, n = ndimage.label(bgish)
    border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    fg = ~np.isin(lab, list(border))
    lab2, n2 = ndimage.label(fg); sizes = ndimage.sum(fg, lab2, range(1, n2 + 1))
    fg = lab2 == (int(np.argmax(sizes)) + 1)          # 只留最大的一塊（去掉飄在旁邊的符號）
    fg = ndimage.binary_fill_holes(fg)
    alpha = fg.astype(np.float32)
    edge = fg & ~ndimage.binary_erosion(fg, iterations=2)
    dark = np.clip((255 - mn) / 90., 0, 1); alpha[edge] = dark[edge]
    alpha = np.clip(ndimage.gaussian_filter(alpha, .6), 0, 1); alpha[ndimage.binary_erosion(fg, iterations=2)] = 1
    a = np.clip(alpha, 1e-3, 1)[..., None]
    out = np.clip((rgb.astype(np.float32) - (1 - a) * 255) / a, 0, 255).astype(np.uint8)
    rgba = np.dstack([out, (alpha * 255).astype(np.uint8)])
    ys, xs = np.nonzero(alpha > .05)
    return Image.fromarray(rgba[ys.min():ys.max() + 1, xs.min():xs.max() + 1], 'RGBA')

if __name__ == '__main__':
    outdir, base = sys.argv[1], int(sys.argv[2])
    pairs = [a.split('=', 1) for a in sys.argv[3:]]
    os.makedirs(outdir, exist_ok=True)
    k = None
    for name, src in pairs:
        spr = cutout(src)
        if k is None: k = base / spr.height
        g = spr.resize((max(1, round(spr.width * k)), max(1, round(spr.height * k))), Image.LANCZOS)
        p = os.path.join(outdir, name + '.webp'); g.save(p, 'WEBP', quality=92, method=6)
        spr.save(os.path.join('/tmp/art', name + '_cutout.png'))
        print(name, spr.size, '->', g.size, os.path.getsize(p))
