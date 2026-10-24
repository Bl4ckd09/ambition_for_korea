# counsel-deid pipeline

상담(심리치료) 녹취록을 AI 학습·평가 데이터로 쓸 수 있게 비식별화하고, 그 결과를 미국 HIPAA Safe Harbor 기준과 재식별 시험으로 평가하는 파이프라인입니다. 출력은 프론트엔드가 읽는 `../data/examples.jsonl` 형식(예시 1건이 한 줄)입니다.

```
원문 ─▶ 1차 Presidio(기본 설정) ─▶ 비식별 시트(Claude, 원문+접수 정보로 1회) ─▶ 8턴 구간 재작성(Claude, 공개 시트만)
                                                                          │
           평가: 룰 검사 + 구간 판정(식별자, 임상 보존) + 세션 판정(조합 단서, 자연스러움, 충실성) + 페르소나 대조
```

## 구성

| 경로 | 역할 |
|---|---|
| `counsel_deid/deid/presidio_stage.py` | 1차: Microsoft Presidio 기본 설정. 정규식과 spaCy NER로 찾은 값을 `<유형>` 태그로 치환 |
| `counsel_deid/deid/sheet.py` | 비식별 시트: 남길 통계, 허용 추론, 대체 표현, 일반화 규칙, 그대로 둘 값. 원문을 보는 유일한 모델 호출이며, 접수 정보 값과 Presidio가 찾은 문자열이 섞이면 코드가 기계적으로 지움 |
| `counsel_deid/deid/rewrite.py` | 2차: 공개 시트와 직전 구간을 들고 8턴씩 재작성. 원문은 넘기지 않음 |
| `counsel_deid/evals/rules.py` | 정답 라벨 없이 도는 룰 검사(SSN, 전화, 이메일, 날짜, 90세 이상, 도시 사전, 기관 접미사, 남은 태그, 위험 용어, 점수·용량, 턴 구조) |
| `counsel_deid/evals/judge.py` | 단답 확률 판정. 식별자와 임상 보존은 구간 단위(식별자는 noisy-OR, 임상은 최댓값), 조합 단서와 자연스러움·충실성은 세션 단위 |
| `counsel_deid/evals/lineup.py` | 재식별 시험: 진짜 1장 + 미끼 9장의 범주형 카드 중 고르기. 미끼는 무작위, 인적사항 유사, 추론 속성까지 유사의 3방식, 대화 없는 대조군 포함 |
| `counsel_deid/evals/verdict.py` | Safe Harbor 항목별 판정: 룰과 판정이 둘 다 걸리면 미통과, 하나만 걸리면 사람 검토 |
| `counsel_deid/clients/claude.py` | Anthropic SDK. 구조화 출력(JSON 스키마), 시스템 프롬프트 캐시, 서버 측 거절 대체(fallbacks) |
| `counsel_deid/clients/jev.py` | TypeSafe Jev(System One API, `POST /v1/systemone`). 예/아니오는 `noul`, 카드 고르기는 `choice`의 확률 분포 |
| `data/` | 합성 상담 3건(`sessions.json`, 테스트용 정답 라벨 포함), 접수 정보, 진짜 페르소나 카드, Nemotron 미끼 풀 |

## 모델 배분

- 재작성과 시트: Claude Sonnet 5.5 (`DEID_REWRITE_MODEL`)
- 판정과 공격자: TypeSafe Jev (`DEID_JUDGE_BACKEND=jev`). 키가 없으면 `DEID_JUDGE_BACKEND=claude`로 Claude Haiku 5.5가 같은 질문에 확률로 답합니다. 작성 모델과 채점 모델을 분리하려고 판단 전용 모델을 기본으로 둡니다.

## 실행

```bash
cd pipeline
python3.12 -m venv .venv && . .venv/bin/activate
pip install -e ".[dev]"
python -m spacy download en_core_web_lg   # Presidio 기본 NER 모델
cp .env.example .env                       # ANTHROPIC_API_KEY, TYPESAFE_API_KEY 입력
python -m counsel_deid run                 # 3건 전부 실행 후 ../data/examples.jsonl 갱신
python -m counsel_deid run --only S1 --out /tmp/s1.jsonl
pytest                                     # 네트워크 없이 가짜 클라이언트로 도는 테스트
```

세션 1건당 호출 수는 대략 Claude 4회(시트 1, 구간 3)와 Jev 50회 안팎(구간 판정 9, 세션 판정 3, 충실성 2, 페르소나 대조 36)입니다.

## 미끼 풀 (NVIDIA Nemotron-Personas-USA)

- `data/nemotron_pool.jsonl.gz`에 범주형 필드(성별, 나이, 결혼 여부, 학력, 직업, 도시, 주) 3만 6,700행을 미리 받아 두었습니다. 실행할 때 내려받지 않으므로 오프라인에서도 같은 결과를 재현할 수 있습니다.
- 드문 조건(예: 90세 이상 사별 남성)의 미끼가 9명보다 적으면 오류로 멈춥니다. `python scripts/fetch_nemotron_pool.py 200`으로 풀을 늘리세요(요청 제한이 걸리면 자동으로 쉬었다 재시도).
- 출처: NVIDIA, [Nemotron-Personas-USA](https://huggingface.co/datasets/nvidia/Nemotron-Personas-USA), CC BY 4.0. 이 저장소는 범주형 필드 일부만 담습니다.

## 데이터에 대해

- `data/sessions.json`의 인물, 번호, 장소는 모두 테스트용으로 지어낸 값입니다. 실제 형식(SSN, 전화번호)을 흉내 내므로 공개 화면에는 합성 데이터 표시를 함께 둡니다.
- `gold` 필드는 테스트용 정답 라벨입니다. 실제 데이터에는 없으며, 그때는 조합 단서와 임상 보존 질문을 시트에서 만듭니다(`pipeline.questions`).
- 실제 상담 기록을 넣으려면 Anthropic과 TypeSafe 양쪽의 BAA와 데이터 보관 조건을 먼저 확인해야 합니다. 이 코드는 합성 데이터 데모 기준입니다.
