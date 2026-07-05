#!/usr/bin/env bash
# Popula matrufsc/public/data com os JSONs de curso versionados na branch `data`
# — a fonte de verdade, atualizada diariamente pelo scraper. Usado tanto no CI
# (etapa antes do build) quanto localmente para desenvolvimento.
#
# `git archive` sem paths, quando executado de um subdiretorio, limita a saida a
# esse subdiretorio; por isso operamos sempre a partir da raiz do repositorio.
set -euo pipefail

root=$(git rev-parse --show-toplevel)
dest="$root/matrufsc/public/data"

git -C "$root" fetch --no-tags --depth=1 origin data
rm -rf "$dest"
mkdir -p "$dest"
git -C "$root" archive FETCH_HEAD | tar -x -C "$dest"

count=$(find "$dest" -name '*.json' | wc -l | tr -d ' ')
echo "Dados de curso extraidos em matrufsc/public/data (${count} arquivos)."
