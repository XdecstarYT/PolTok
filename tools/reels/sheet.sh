#!/usr/bin/env bash
# usage: sheet.sh <out.jpg> <cols> img1 img2 ...  (contact sheet of stills, 360px wide tiles)
out=$1; cols=$2; shift 2
n=$#; ins=(); f=""; lay=""
i=0; for x in "$@"; do ins+=(-i "$x"); f+="[$i:v]scale=360:640[s$i];"; lay+="$(( (i % cols) * 360 ))_$(( (i / cols) * 640 ))|"; i=$((i+1)); done
for ((j=0;j<n;j++)); do f+="[s$j]"; done
ffmpeg -y -loglevel error "${ins[@]}" -filter_complex "${f}xstack=inputs=$n:layout=${lay%|}:fill=black[o]" -map "[o]" -q:v 3 "$out"
