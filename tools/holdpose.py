# 「捧著食物」姿勢圖（手裡是洋紅色 #FF00FF 圓形佔位）→ 兩層去背圖＋食物位置
#   {名稱}_act_hold.webp        身體層：洋紅色的地方用胸口毛色補上
#   {名稱}_act_hold_front.webp  前掌層：只留蓋在圓形前面的手掌，畫在食物上面
# 程式畫法：身體層 → 食物圖示（放在錨點）→ 前掌層，看起來就是雙手捧著食物。
# 用法：python3 -I tools/holdpose.py <輸出資料夾> <名稱> <來源圖> <參考圖：同角色現有的吃東西圖（姿勢相近，用它的高度對齊大小）>
#   印出 HOLD 錨點（相對圖片：x 從中心算、y 從底部算，都除以圖高；r 是圓半徑/圖高）
import sys, os, json
import numpy as np
from PIL import Image
from scipy import ndimage
sys.path.insert(0, os.path.dirname(__file__))
from cutout import cutout

def magenta_mask(rgb):
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    return (r > 170) & (b > 150) & (g < 120) & (np.abs(r - b) < 90)

def main(outdir, name, src, ref):
    spr = cutout(src)                                  # 去白背景（洋紅圓屬於前景，會留著）
    H0 = spr.height
    a = np.asarray(spr).astype(np.int16); rgb = a[..., :3]; al = a[..., 3]
    mag = magenta_mask(rgb) & (al > 0)
    lab, n = ndimage.label(mag); sizes = ndimage.sum(mag, lab, range(1, n + 1))
    mag = lab == (int(np.argmax(sizes)) + 1)
    # 洋紅邊緣的混色也算進來
    ring = ndimage.binary_dilation(mag, iterations=3) & ~mag
    pinkish = (rgb[..., 0] - rgb[..., 1] > 60) & (rgb[..., 2] - rgb[..., 1] > 40)
    mag = mag | (ring & pinkish)
    # 圓形範圍＝洋紅區的凸包（包含被手掌蓋住的部分）
    ys, xs = np.nonzero(mag)
    from scipy.spatial import ConvexHull
    from matplotlib.path import Path
    pts = np.c_[xs, ys]; hull = ConvexHull(pts)
    yy, xx = np.mgrid[:mag.shape[0], :mag.shape[1]]
    inside = Path(pts[hull.vertices]).contains_points(np.c_[xx.ravel(), yy.ravel()]).reshape(mag.shape)
    # 前掌＝圓形範圍內不是洋紅的部分；先去掉圓周上的細邊（opening），只留成塊的手掌
    front = inside & ~ndimage.binary_dilation(mag, iterations=1) & (al > 0)
    front = ndimage.binary_opening(front, iterations=3)
    lab3, n3 = ndimage.label(front); s3 = ndimage.sum(front, lab3, range(1, n3 + 1))
    front = np.isin(lab3, [i + 1 for i, s in enumerate(s3) if s > inside.sum() * .02])
    # 擴展成整隻手掌：外框線圍起來的淺色區塊只要碰到上面的碎片就整塊收進來（太大的是身體，不收）
    lum = rgb[..., :3].mean(2); dark = (lum < 130) & (al > 0)
    light = (al > 0) & ~dark & ~ndimage.binary_dilation(mag, iterations=1)
    lab4, n4 = ndimage.label(light)
    paw = np.zeros_like(front)
    for i in np.unique(lab4[front]):
        if i == 0: continue
        blob = lab4 == i
        if blob.sum() < inside.sum() * 1.5: paw |= blob
    paw |= front
    front = paw | (ndimage.binary_dilation(paw, iterations=4) & dark)   # 加上手掌外框線
    # 身體層：洋紅區填胸口毛色（圓外圈的淺色像素平均）
    ring2 = ndimage.binary_dilation(inside, iterations=8) & ~inside & (al > 200)
    light = ring2 & (rgb.min(2) > 150)
    fill = np.median(rgb[light], 0) if light.sum() > 20 else np.array([250, 240, 228])
    body = a.copy(); body[mag, :3] = fill; body[mag, 3] = 255
    fr = np.zeros_like(a); fr[front] = a[front]
    tint = front & ndimage.binary_dilation(mag, iterations=4) & (rgb[..., 2] - rgb[..., 1] > 25)   # 外框線沾到的洋紅色改回棕色
    fr[tint, :3] = [74, 42, 22]
    # 和 idle 同比例（idle 高 384）
    k = Image.open(ref).height / H0
    os.makedirs(outdir, exist_ok=True)
    W, H = spr.size; size = (round(W * k), round(H * k))
    Image.fromarray(body.astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS).save(f'{outdir}/{name}_act_hold.webp', 'WEBP', quality=92, method=6)
    Image.fromarray(fr.astype(np.uint8), 'RGBA').resize(size, Image.LANCZOS).save(f'{outdir}/{name}_act_hold_front.webp', 'WEBP', quality=92, method=6)
    cy, cx = ys.mean(), xs.mean(); r = (np.sqrt(inside.sum() / np.pi))
    print(json.dumps({name: [round((cx - W / 2) / H, 3), round((H - cy) / H, 3), round(r / H, 3)]}))

if __name__ == '__main__':
    main(*sys.argv[1:5])
