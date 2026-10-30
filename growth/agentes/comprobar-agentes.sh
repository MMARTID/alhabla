#!/bin/bash
# Comprobaciones sin red de los agentes de Alhabla Growth (Fase 2b):
#
#   growth/agentes/comprobar-agentes.sh
#
# 1. El MCP tiene 18 herramientas y los nombres se leen de
#    backend/mcp/growth/herramientas.ts (la fuente de verdad).
# 2. Cada .claude/agents/growth-*.md: frontmatter completo, `name` igual al
#    fichero, solo herramientas que existen, ninguna de escritura de ficheros,
#    shell, navegador, correo o mensajería, y las prohibidas en `disallowedTools`.
# 3. Cada nombre de herramienta de Growth que el cuerpo del prompt cita entre
#    comillas invertidas está en la lista de ese subagente (salvo en las líneas
#    que dicen «no usas …»).
# 4. Los ficheros de reglas que citan los prompts existen.
# 5. El comando /growth-run solo pre-aprueba herramientas que existen.
# 6. El orquestador solo lanza subagentes que existen.
# 7. Las reglas que escribe growth-cumplimiento no se llaman como las del motor.
# 8. .claude/settings.json es JSON válido y su hook apunta a un script que existe.
#
# Sale con 1 si algo falla.

set -u

RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$RAIZ" || exit 1

HERRAMIENTAS_TS="backend/mcp/growth/herramientas.ts"
CUMPLIMIENTO_TS="backend/src/modules/growth/cumplimiento.ts"
ESPERADAS=18
fallos=0

fallo() {
  echo "FALLO  $1"
  fallos=$((fallos + 1))
}
bien() {
  echo "ok     $1"
}

# ── 1. Las herramientas del MCP ──────────────────────────────────────────
herramientas="$(awk '/NOMBRES_DE_HERRAMIENTAS_DE_GROWTH = \[/{d=1;next} d&&/\] as const/{d=0} d{gsub(/[ ",]/,""); if ($0!="") print}' "$HERRAMIENTAS_TS")"
total="$(printf '%s\n' "$herramientas" | grep -c .)"
if [ "$total" -eq "$ESPERADAS" ]; then
  bien "el MCP alhabla-growth tiene $ESPERADAS herramientas ($HERRAMIENTAS_TS)"
else
  fallo "el MCP tiene $total herramientas y se esperaban $ESPERADAS: actualiza los agentes y este script"
fi

existe_herramienta() {
  printf '%s\n' "$herramientas" | grep -qx "$1"
}

# Lo que ningún agente de Growth puede tener.
PROHIBIDAS='^(Write|Edit|Bash|NotebookEdit|Monitor)$|playwright|chrome|browser|gmail|zoho|whatsapp|slack|mcp__alhabla-dev|computer|notion|github|stripe|telnyx'

# Las herramientas de la lista `tools:` de un fichero, una por línea.
tools_de() {
  awk '
    NR==1 && $0=="---" {fm=1; next}
    fm && $0=="---" {exit}
    fm && /^tools:/ {t=1; next}
    fm && t && /^  - / {sub(/^  - /,""); print; next}
    fm && t {t=0}
  ' "$1"
}

campo_de() {
  awk -v campo="$2" '
    NR==1 && $0=="---" {fm=1; next}
    fm && $0=="---" {exit}
    fm && index($0, campo ":")==1 {sub(campo ": *",""); print; exit}
  ' "$1"
}

# ── 2 y 3. Los subagentes ────────────────────────────────────────────────
subagentes="$(ls .claude/agents/growth-*.md 2>/dev/null)"
cuantos="$(printf '%s\n' "$subagentes" | grep -c .)"
if [ "$cuantos" -eq 6 ]; then
  bien "hay 6 subagentes growth-*"
else
  fallo "hay $cuantos subagentes growth-* y se esperaban 6"
fi

for f in $subagentes; do
  base="$(basename "$f" .md)"
  nombre="$(campo_de "$f" name)"
  [ "$nombre" = "$base" ] && bien "$base: name coincide con el fichero" || fallo "$base: name «$nombre» no coincide con el fichero"
  [ -n "$(campo_de "$f" description)" ] || fallo "$base: falta description"
  [ -n "$(campo_de "$f" model)" ] || fallo "$base: falta model"
  [ -n "$(campo_de "$f" maxTurns)" ] || fallo "$base: falta maxTurns"

  lista="$(tools_de "$f")"
  if [ -z "$lista" ]; then
    fallo "$base: no tiene lista tools"
    continue
  fi

  malas=""
  while IFS= read -r t; do
    case "$t" in
      mcp__alhabla-growth__*)
        existe_herramienta "${t#mcp__alhabla-growth__}" || malas="$malas $t(no existe)"
        ;;
      Read|Grep|Glob|WebSearch|WebFetch)
        ;;
      *)
        malas="$malas $t(no permitida)"
        ;;
    esac
    if printf '%s' "$t" | grep -Eqi "$PROHIBIDAS"; then
      malas="$malas $t(prohibida)"
    fi
  done <<EOT
$lista
EOT
  [ -z "$malas" ] && bien "$base: solo herramientas permitidas y existentes ($(printf '%s\n' "$lista" | grep -c .))" || fallo "$base: herramientas con problemas:$malas"

  deny="$(campo_de "$f" disallowedTools)"
  faltan=""
  for p in Write Edit Bash; do
    printf '%s' "$deny" | grep -qw "$p" || faltan="$faltan $p"
  done
  [ -z "$faltan" ] && bien "$base: disallowedTools incluye Write, Edit y Bash" || fallo "$base: disallowedTools no incluye:$faltan"

  # 3. Herramientas de Growth citadas en el cuerpo que no están en tools.
  citadas="$(awk 'BEGIN{n=0} /^---$/{n++; next} n>=2 && !/[Nn]o (usas|uses|tienes)/ {print}' "$f" | grep -o '`[a-z_]*`' | tr -d '`' | sort -u)"
  sobran=""
  for c in $citadas; do
    if existe_herramienta "$c"; then
      printf '%s\n' "$lista" | grep -qx "mcp__alhabla-growth__$c" || sobran="$sobran $c"
    fi
  done
  [ -z "$sobran" ] && bien "$base: el cuerpo solo cita herramientas que tiene" || fallo "$base: el cuerpo cita herramientas que no están en su tools:$sobran"

  # 4. Reglas citadas.
  for r in $(grep -o 'growth/agentes/reglas/[a-z-]*\.md' "$f" | sort -u); do
    [ -f "$r" ] || fallo "$base: cita $r y no existe"
  done
done

# 4 (orquestador, README, comando).
for f in growth/agentes/orquestador.md growth/agentes/README.md .claude/commands/growth-run.md; do
  for r in $(grep -o 'growth/agentes/reglas/[a-z-]*\.md' "$f" | sort -u); do
    [ -f "$r" ] || fallo "$f: cita $r y no existe"
  done
done
bien "los ficheros de reglas citados existen"

# ── 5. El comando ────────────────────────────────────────────────────────
comando=".claude/commands/growth-run.md"
permitidas="$(campo_de "$comando" allowed-tools | tr ',' '\n' | sed 's/^ *//')"
malas=""
while IFS= read -r t; do
  case "$t" in
    mcp__alhabla-growth__*) existe_herramienta "${t#mcp__alhabla-growth__}" || malas="$malas $t(no existe)" ;;
    Read|Grep|Glob|Agent) ;;
    *) malas="$malas $t(no permitida)" ;;
  esac
done <<EOT
$permitidas
EOT
[ -z "$malas" ] && bien "/growth-run solo pre-aprueba herramientas que existen" || fallo "/growth-run: allowed-tools con problemas:$malas"
sin_preaprobar=""
for h in $herramientas; do
  printf '%s\n' "$permitidas" | grep -qx "mcp__alhabla-growth__$h" || sin_preaprobar="$sin_preaprobar $h"
done
[ -z "$sin_preaprobar" ] && bien "/growth-run pre-aprueba las 18 herramientas" || fallo "/growth-run no pre-aprueba:$sin_preaprobar"

# ── 6. El orquestador ────────────────────────────────────────────────────
for a in $(grep -oE 'growth-[a-z]+(-[a-z]+)*' growth/agentes/orquestador.md | sort -u); do
  case "$a" in
    growth-run) ;;
    *) [ -f ".claude/agents/$a.md" ] || fallo "orquestador.md nombra el subagente $a y no existe" ;;
  esac
done
bien "el orquestador solo nombra subagentes que existen"

# ── 7. Reglas del modelo frente a las del motor ──────────────────────────
motor="$(awk '/NOMBRES_DE_REGLAS_(DURAS|BLANDAS) = \[/{d=1;next} d&&/\] as const/{d=0} d{gsub(/[ ",]/,""); if ($0!="") print}' "$CUMPLIMIENTO_TS")"
choques=""
for r in $(grep -o '`[a-z_]*`' .claude/agents/growth-cumplimiento.md | tr -d '`' | sort -u); do
  printf '%s\n' "$motor" | grep -qx "$r" && choques="$choques $r"
done
[ -z "$choques" ] && bien "growth-cumplimiento no usa nombres de reglas del motor" || fallo "growth-cumplimiento nombra reglas del motor:$choques"

# ── 8. settings.json y el hook ───────────────────────────────────────────
if node -e "JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8'))" 2>/dev/null; then
  bien ".claude/settings.json es JSON válido"
  guion="$(node -e "const s=JSON.parse(require('fs').readFileSync('.claude/settings.json','utf8')); const h=s.hooks.PreToolUse.flatMap(g=>g.hooks.map(x=>x.command)).join('\n'); console.log(h)")"
  ruta="$(printf '%s' "$guion" | grep -o 'growth/agentes/hooks/[a-z-]*\.sh' | head -1)"
  if [ -n "$ruta" ] && [ -f "$ruta" ]; then
    bien "el hook apunta a $ruta, que existe"
  else
    fallo "el hook de .claude/settings.json no apunta a un script que exista"
  fi
else
  fallo ".claude/settings.json no es JSON válido (o no existe)"
fi

echo
if [ "$fallos" -gt 0 ]; then
  echo "$fallos comprobaciones fallan."
  exit 1
fi
echo "Todo en orden."
