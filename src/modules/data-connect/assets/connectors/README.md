# 连接器品牌素材

本目录的八种品牌素材均直接复制自 [DBeaver Community](https://github.com/dbeaver/dbeaver/tree/0ccf31d149e81cd989b07a66c0018884e6737042)，用于标识连接器对应的数据源。

- 固定来源 commit：`0ccf31d149e81cd989b07a66c0018884e6737042`。
- 上游许可证原文：[DBeaver-LICENSE.txt](./DBeaver-LICENSE.txt)，按原始字节保留。
- 来源项目：DBeaver Community，DBeaver Corp 及其贡献者。品牌标识权利归各自权利人所有，不表示品牌方对 OpenBKN 的背书。
- 文件保留原始字节，不重绘、不放大生成新图、不裁切或改变颜色；通过 CSS 等比缩放，外层不添加背景或边框。
- 展示区域统一为 `60 × 60px`，与连接器名称组成纵向分组，间距 `8px`；分组按内容宽度靠卡片左侧放置，组内 logo 与名称上下居中对齐，所有标识保持原始比例。
- PNG 按像素面积（宽 × 高）比较对应连接器的全部 PNG 候选，选取分辨率最大的文件；七种连接器最终均为 `128 × 128` 的 `*_icon_big@2x.png`。
- Doris 的当前图标目录及首次引入版本均只有 SVG，没有 PNG；直接复制大号 `doris_icon_big.svg`（标称 `64 × 64`），不自行转成 PNG。
- 未知或自定义连接器继续使用项目已有的通用数据库图标。

## 文件来源

下列路径均相对于上述 DBeaver commit 的仓库根目录。

| 本地文件         | 原始路径                                                                                                                                                                                                                                | 尺寸         |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ |
| `mysql.png`      | [plugins/org.jkiss.dbeaver.ext.mysql/icons/mysql_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.mysql/icons/mysql_icon_big@2x.png)                     | 128 × 128    |
| `mariadb.png`    | [plugins/org.jkiss.dbeaver.ext.mysql/icons/mariadb_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.mysql/icons/mariadb_icon_big@2x.png)                 | 128 × 128    |
| `postgresql.png` | [plugins/org.jkiss.dbeaver.ext.postgresql/icons/postgresql_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.postgresql/icons/postgresql_icon_big@2x.png) | 128 × 128    |
| `sqlserver.png`  | [plugins/org.jkiss.dbeaver.ext.mssql/icons/mssql_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.mssql/icons/mssql_icon_big@2x.png)                     | 128 × 128    |
| `oracle.png`     | [plugins/org.jkiss.dbeaver.ext.oracle/icons/oracle_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.oracle/icons/oracle_icon_big@2x.png)                 | 128 × 128    |
| `hana.png`       | [plugins/org.jkiss.dbeaver.ext.hana/icons/sap_hana_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.hana/icons/sap_hana_icon_big@2x.png)                 | 128 × 128    |
| `opensearch.png` | [plugins/org.jkiss.dbeaver.ext.generic/icons/opensearch_icon_big@2x.png](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.generic/icons/opensearch_icon_big@2x.png)       | 128 × 128    |
| `doris.svg`      | [plugins/org.jkiss.dbeaver.ext.doris/icons/doris_icon_big.svg](https://github.com/dbeaver/dbeaver/blob/0ccf31d149e81cd989b07a66c0018884e6737042/plugins/org.jkiss.dbeaver.ext.doris/icons/doris_icon_big.svg)                           | SVG，64 × 64 |

## SHA-256

| 文件                  | SHA-256                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `DBeaver-LICENSE.txt` | `3574a35d6ceb85fe03ed8dee865ebfcfbbd7c6de6899e890966f437ffe177373` |
| `doris.svg`           | `c7934746a45d1858493f88c68dfd2fd189e34c386e28e0e5fe0711e0837ac6ba` |
| `hana.png`            | `a4fd39256410b916c77a4ba558dc1278b8943d4db7da0f0667871cb22bba0762` |
| `mariadb.png`         | `077e61c3e14b464ce456b99a411e2811f2984f232b9ed51f47c6c7549c9715da` |
| `mysql.png`           | `0f58fd8c5f96e2155a0457dbfc9882c5ff63db9f0c725818294b806e9d20352c` |
| `opensearch.png`      | `242667f1f9a536785df22a488de0d5f2aefbffdb77bb59234c71ccc4e9d6682f` |
| `oracle.png`          | `272761a9c76f219eebf483f843638b20779aaae3b06a6d97259569c2711d5aea` |
| `postgresql.png`      | `577ea028561a765f530c2611fa2557103387b60f2e5ab8e70f629fdfc22b6156` |
| `sqlserver.png`       | `b627bdfe3aede4a86d0019ac7a02ac7b5f5153fc239b3fb939607c86c318ac4d` |
