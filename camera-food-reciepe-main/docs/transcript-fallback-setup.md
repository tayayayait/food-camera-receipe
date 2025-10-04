# Transcript Fallback Pipeline Setup

이 문서는 `/api/transcript/fallback` 엔드포인트를 통해 추천 동영상에 자막을 보조로 제공하는 방법을 설명합니다. 기본 `/api/transcript`가 `"unavailable"`을 반환하거나 호출이 실패하면 프런트엔드가 폴백 엔드포인트를 호출해 시청 노트에 필요한 핵심 문장을 채웁니다.

## 1. 필수 도구 설치

1. **youtube-dl / yt-dlp**
   - YouTube 오디오 스트림을 내려받기 위해 `yt-dlp`(추천) 또는 `youtube-dl`을 설치하세요.
   - 예: `pip install yt-dlp` 혹은 macOS Homebrew의 `brew install yt-dlp`.
2. **Speech-to-Text 엔진**
   - Google Cloud Speech-to-Text, Whisper API 등 원하는 STT 서비스를 선택하고 API 키를 발급받습니다.
   - 백엔드에서 사용할 환경 변수를 `SPEECH_TO_TEXT_API_KEY`(또는 해당 서비스가 요구하는 이름)로 저장합니다.

## 2. 백엔드 환경 변수

| 변수 | 설명 | 비고 |
| --- | --- | --- |
| `VIDEO_TRANSCRIPT_SERVICE_URL` | 기본 `/api/transcript` 절대 URL. 미설정 시 프런트엔드는 상대 경로(`/api/transcript`)를 사용합니다. | 선택 |
| `VIDEO_TRANSCRIPT_FALLBACK_SERVICE_URL` | 폴백 `/api/transcript/fallback` 절대 URL. 미설정 시 프런트엔드는 상대 경로(`/api/transcript/fallback`)를 호출합니다. | 선택 |
| `SPEECH_TO_TEXT_API_KEY` | STT 서비스 인증 키. 백엔드에서 필수입니다. | 필수 |
| `YTDL_PATH` | (선택) yt-dlp/youtube-dl 실행 파일 위치를 지정할 수 있습니다. PATH에 존재하면 생략 가능합니다. | 선택 |

## 3. 폴백 엔드포인트 구현 가이드

1. **오디오 추출**
   - `yt-dlp` 또는 `youtube-dl`을 사용하여 `videoId`로 YouTube 오디오를 내려받습니다.
   - 다운로드 시 임시 디렉터리를 사용하고, 처리 완료 후 파일을 삭제하세요.
2. **음성-텍스트 전사**
   - STT API에 오디오 파일을 업로드 또는 스트리밍하여 전사를 수행합니다.
   - 응답을 `[{ text: string, start?: number, duration?: number }]` 형태로 변환하세요.
3. **응답 포맷**
   - 성공 시: `{ "segments": TranscriptSegment[] }`를 JSON으로 반환합니다.
   - 전사가 생성되지 않은 경우: `{ "segments": [], "reason": "설명" }` 형태로 반환하면 프런트엔드가 사유를 표시합니다.
4. **에러 처리**
   - 네트워크 오류나 일시적 실패는 HTTP 500으로 응답하고 로그를 남깁니다.
   - 자막이 존재하지 않는 경우 HTTP 404를 반환하면 프런트엔드가 메타데이터 전용 메시지를 노출합니다.

## 4. 로컬 검증 절차

1. 백엔드에서 `/api/transcript`와 `/api/transcript/fallback` 두 엔드포인트를 모두 구동합니다.
2. `.env.local` 등에 필요한 환경 변수를 설정한 뒤 프런트엔드를 실행합니다.
3. 자막이 없는 YouTube 영상 ID로 추천 영상을 확인해 폴백 전사가 정상적으로 시청 노트 안내에 포함되는지 확인합니다.
4. 백엔드 로그에서 오디오 다운로드 및 STT 호출이 성공했는지 검토합니다.

이 설정을 완료하면 자막이 없는 영상도 자동으로 보조 설명을 제공해, 사용자가 추천 영상을 시청할 때 참고할 수 있습니다.
