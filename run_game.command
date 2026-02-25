#!/bin/bash

# 스크립트가 위치한 디렉토리의 절대 경로를 구하고 이동합니다.
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "========================================="
echo " The Chronicle of Shadows - 로컬 실행 스크립트"
echo "========================================="
echo ""
echo "의존성 패키지를 확인하고 설치합니다..."
npm install > /dev/null 2>&1

echo ""
echo "로컬 개발 서버를 시작합니다..."
echo "종료하려면 이 터미널 창을 닫거나 Ctrl+C를 누르세요."
echo "========================================="

# npm run dev 실행
npm run dev
