"""检查中英文字形并生成 WOFF2；只转换压缩格式，不删字形、不改变原始字体设计。"""
from pathlib import Path
from fontTools.ttLib import TTFont


def prepare_font(filename: str, expected: str) -> None:
    # 字体文件随创作端发布，中文必须由本地 Noto Sans SC 覆盖，不能只验证 CSS 名称。
    directory = Path(__file__).resolve().parents[1] / "public" / "fonts"
    font = TTFont(directory / filename)
    missing = [char for char in expected if ord(char) not in font.getBestCmap()]
    if missing:
        raise ValueError(f"{filename} 缺少必需字形：{''.join(missing)}")
    font.flavor = "woff2"
    destination = (directory / filename).with_suffix(".woff2")
    font.save(destination)
    print(f"{destination.name}: {destination.stat().st_size} bytes；字形检查通过")


if __name__ == "__main__":
    prepare_font("GoogleSansFlex-Variable.ttf", "Livliv0123456789")
    prepare_font("NotoSansSC-Variable.ttf", "资产创作积分技能我的配音资料库，。")
