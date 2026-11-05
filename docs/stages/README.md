# 阶段目录使用说明

INIT已完成，Stage00原型待人工验收，执行事实见RESULT第11节，Stage01～05未启动。Stage00唯一当前有效目录为[stage-00](stage-00/REQUIREMENTS.md)，仅维护REQUIREMENTS、PLAN、ACCEPTANCE、RESULT四文档。

用户启动 StageXX 时，从 [阶段模板目录](../templates/stage/REQUIREMENTS.md)复制四份模板到 `docs/stages/stage-XX/`，然后根据 [总体需求](../OVERALL_REQUIREMENTS.md)、[范围台账](../SCOPE_REGISTER.md)、[问题台账](../OPEN_QUESTIONS.md)和 [工作流](../WORKFLOW.md)逐步填写。

| 阶段文件 | 创建后初始状态 |
|---|---|
| REQUIREMENTS.md | 草案，区分已确认规则与待确认项 |
| PLAN.md | 待计划，不提前认定可实施 |
| ACCEPTANCE.md | 场景待设计，实际结果均未执行 |
| RESULT.md | 未实施，不预填通过、提交SHA或研发接收 |

Stage01内01A收费停车和01B工单隐患共享四份文档，通过章节、需求编号及交接版本分别推进。Stage04的各专项也在同一组文档内分件管理。

模板中的占位内容应在具体阶段启动后替换；保留待确认的问题编号和影响范围。完成一个独立业务包即可按实际授权交接，不必等待同阶段所有专项完成。

2026-11-04修订：将用户放入`stage00/`的四份有效输入归并至规范目录`stage-00/`，没有第二套当前文档。需求V0.2已审，当前V0.3作最小同步；PLAN/ACCEPTANCE待本轮提交后复核，不自动实施。
