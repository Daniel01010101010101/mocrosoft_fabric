# Fabric Radar · Centro de inteligencia de Microsoft Fabric

**Sitio publicado:** https://daniel01010101010101.github.io/mocrosoft_fabric/

Plataforma web en español que **consulta automáticamente las fuentes oficiales de Microsoft Fabric cinco veces al día**, guarda cada novedad en una base de datos persistente, la **traduce y analiza con IA** y la presenta en un dashboard con histórico, roadmap, categorías y trazabilidad completa.

> Proyecto independiente, no afiliado a Microsoft. Toda la información procede de fuentes oficiales y enlaza siempre a la publicación original.

---

## Qué hace

| Requisito | Cómo se cumple |
|---|---|
| Consulta automática 5 veces al día | Workflow programado de GitHub Actions (`.github/workflows/ingest.yml`) a las 06:17, 11:17, 16:47, 19:47 y 23:17 UTC. No depende de que nadie abra la página. |
| Fuentes oficiales | Microsoft Fabric Updates Blog (RSS), Power BI Updates Blog (RSS), Microsoft Learn *What's new in Microsoft Fabric*, Azure Updates (API oficial, filtrada a Fabric/OneLake) y Microsoft Fabric Roadmap (endpoint JSON del roadmap oficial). |
| Todo en español | Tres capas: (1) la **versión oficial en español de Microsoft Learn** (`es-es`) se empareja fila a fila con la inglesa; (2) **traducciones guardadas** en `data/translations/` para el blog, Azure Updates y el roadmap; (3) traducción y análisis con Claude para todo lo nuevo (requiere `ANTHROPIC_API_KEY`). Se conservan los nombres técnicos y siempre el enlace a la publicación original. |
| Sección PowerTable | Página `/powertable` con una guía completa para empezar desde cero (qué es, requisitos, costes con calculadora, primera app paso a paso, diseño de datos, seguridad, automatizaciones, límites, errores frecuentes, plan de implantación, checklist y FAQ) y las novedades y elementos del roadmap de PowerTable/Planning detectados automáticamente. |
| Análisis detallado | Cada novedad tiene una ficha con: nombre, fecha, categoría, resumen ejecutivo, qué es, cómo funciona (con diagrama de flujo), qué problema resuelve, ventajas, cómo implementarla, casos de uso, impacto, ejemplo de código, documentación oficial y publicación original. |
| Histórico por días, semanas y meses | Secciones *Últimas novedades*, *Últimas semanas* (7/15/30 días), *Histórico* (agrupado por mes, filtros por fecha, categoría y tecnología, buscador) y *Roadmap*. |
| Dashboard | Totales, hoy, semana, mes, funcionalidades nuevas, Preview, GA, categorías más activas, evolución mensual, top 5 y novedades transformadoras. |
| Trazabilidad | Panel *Estado del sistema*: última actualización exitosa, última consulta, próxima ejecución, estado, novedades encontradas, errores por fuente e historial de ejecuciones. |
| Sin duplicados | Identificador único estable por novedad, normalización de URLs y vinculación entre fuentes (p. ej. la entrada de Learn que enlaza al post del blog). |
| Sin traducciones repetidas | Cada análisis guarda el hash del contenido original: solo se regenera si Microsoft modifica la publicación. |
| Sin registros sin fuente | Validación: título, fecha válida, contenido mínimo y URL HTTPS de un dominio oficial de Microsoft. |
| Sin pérdida de histórico | Nada se borra: lo que desaparece de una fuente se marca y se conserva; todo cambio queda en el historial de Git. |
| Errores y reintentos | Reintentos con backoff por petición, reintento completo del workflow, registro del fallo y estado honesto (una ejecución solo es «correcta» si todas las fuentes respondieron). |

## Arquitectura

```
                 ┌─────────────── GitHub Actions (cron 5×/día) ───────────────┐
                 │                                                             │
 Fuentes         │  pipeline/ (Node 22 + TypeScript)                           │
 oficiales ────▶ │   1. Consulta (HTTP con reintentos, ETag/If-Modified-Since) │
  · Fabric Blog  │   2. Normalización, saneado HTML, detección de idioma       │
  · Power BI Blog│   3. Validación + deduplicación + historial de cambios     │
  · Learn        │   4. Clasificación (16 categorías, fase, tipo, impacto)    │
  · Azure Updates│   5. Traducción y análisis con Claude (salida estructurada) │
  · Roadmap      │   6. Registro de la ejecución y estado                      │
                 │            │                                                │
                 │            ▼                                                │
                 │   data/  ← base de datos documental versionada en Git       │
                 │            │  (commit automático)                           │
                 │            ▼                                                │
                 │   npm run build → API JSON estática + frontend React        │
                 └────────────┼────────────────────────────────────────────────┘
                              ▼
                       GitHub Pages (sitio público)
```

- **Backend / procesamiento:** `pipeline/` — CLI en TypeScript ejecutado por GitHub Actions.
- **Base de datos persistente:** `data/` — un documento JSON por novedad (`data/updates/<id>.json`) y por elemento del roadmap (`data/roadmap/<id>.json`), registro mensual de ejecuciones (`data/runs/AAAA-MM.json`), estado (`data/status.json`), caché HTTP y de documentación (`data/state`, `data/cache`). Escrituras atómicas y solo de lo modificado. El historial de Git es la auditoría completa.
- **Servicio de traducción con IA:** `pipeline/src/ai/` — API de Anthropic (Claude) con salida estructurada validada por esquema, streaming, reintentos y respaldo del lado del servidor.
- **Caché:** peticiones condicionales a las fuentes, caché de 30 días de la documentación de Microsoft Learn usada como contexto, análisis por hash de contenido y caché en el navegador (TanStack Query).
- **Frontend:** `web/` — React 19 + Vite + Tailwind CSS 4 + Motion. Consume una API JSON estática generada en cada build (`npm run export`).
- **Escalabilidad:** la capa de almacenamiento está aislada en `pipeline/src/core/store.ts`; puede sustituirse por PostgreSQL u otra base de datos sin tocar fuentes, IA ni frontend.

## Ramas y publicación

- **`main` es la rama de producción**: contiene la base de datos actualizada y es la única autorizada a desplegar en el entorno `github-pages`. Cada ejecución automática trabaja sobre `main`, guarda allí los datos y lanza el workflow *Publicar en GitHub Pages*.
- Los cron de GitHub Actions se disparan desde la rama por defecto del repositorio, pero siempre operan sobre `main`, así que la automatización funciona sea cual sea la rama por defecto (se recomienda que sea `main`).
- Cualquier cambio de código que llegue a `main` se publica automáticamente.

## Puesta en marcha

1. GitHub Pages ya está activado con origen **GitHub Actions** y el sitio publicado.
2. **Añadir la clave de IA** para la traducción: *Settings → Secrets and variables → Actions → New repository secret*
   - Nombre: `ANTHROPIC_API_KEY`
   - Valor: tu clave de la API de Anthropic (https://console.anthropic.com).
3. Opcional: *Actions → «Ingesta automática de novedades» → Run workflow* para no esperar a la siguiente ejecución programada. Para procesar más rápido el histórico inicial puedes indicar, por ejemplo, `ai_max_updates = 120` y `ai_max_roadmap_batches = 50`.

A partir de ahí todo es automático: cada ejecución consulta las fuentes, actualiza la base de datos, la guarda en `main` y publica el sitio.

> Sin `ANTHROPIC_API_KEY` la plataforma funciona igualmente: consulta, almacena y muestra las novedades, y las enseña en español usando la traducción oficial de Microsoft Learn y las traducciones guardadas en `data/translations/`. Lo que se publique nuevo en el blog o en Azure Updates, y las fichas de análisis completas, aparecerán con la etiqueta «Traducción pendiente» hasta que se configure la clave. Nota: GitHub Models no se usa porque GitHub lo retiró el 30 de julio de 2026.

### Variables opcionales (*Settings → Secrets and variables → Actions → Variables*)

| Variable | Por defecto | Descripción |
|---|---|---|
| `AI_MODEL` | `claude-opus-5-5` | Modelo de Claude usado para traducir y analizar. |
| `AI_EFFORT` | `medium` | Esfuerzo del análisis detallado (`low`, `medium`, `high`…). |
| `AI_ROADMAP_EFFORT` | `low` | Esfuerzo de la traducción de elementos del roadmap. |
| `AI_MAX_UPDATES_PER_RUN` | `30` | Novedades analizadas como máximo por ejecución (controla coste y duración). |
| `AI_MAX_ROADMAP_BATCHES_PER_RUN` | `8` | Lotes de 25 elementos del roadmap traducidos por ejecución. |

**Coste orientativo de IA** (Claude Opus 5.5, 4 $/20 $ por millón de tokens de entrada/salida): unos 0,10 $ por ficha de análisis y unos 0,15 $ por lote de 25 elementos del roadmap. La carga inicial (≈380 novedades y ≈1.100 elementos del roadmap) ronda los 45 $ y se reparte en los primeros días; después, con 5–15 novedades diarias, el coste habitual es de 0,5–1,5 $ al día. Para reducirlo se puede usar `AI_MODEL=claude-sonnet-5-5` (aprox. la mitad) o `claude-haiku-5-5` (mucho menor, con análisis menos profundos). Son estimaciones; el consumo real de cada ejecución aparece en el panel de estado.

## Desarrollo local

```bash
npm ci
npm run ingest          # consulta las fuentes y actualiza data/ (usa ANTHROPIC_API_KEY si existe)
npm run ingest:no-ai    # solo ingesta, sin traducción
npm run dev             # genera la API y arranca el frontend en http://localhost:5173
npm run check           # tipos + tests
npm run build           # API estática + build de producción en web/dist
```

## Estructura

```
.github/workflows/   ingest.yml (cron 5×/día + publicación), pages.yml (despliegue), ci.yml
pipeline/src/
  sources/           rss.ts, learnWhatsNew.ts, azureUpdates.ts, roadmap.ts
  core/              http.ts, store.ts, ingest.ts, classify.ts, language.ts, validate.ts, text.ts,
                     learnSpanish.ts (traducción oficial es-es), storedTranslations.ts
  ai/                client.ts, prompts.ts, schema.ts, context.ts, enrich.ts
  export/buildApi.ts API JSON estática para el frontend
  run.ts, cli.ts     orquestación de una ejecución y CLI
pipeline/test/       tests de fuentes, ingesta, IA, calendario y estado
shared/              tipos, categorías y calendario compartidos por pipeline y frontend
web/src/             frontend (páginas, componentes, gráficos, búsqueda)
web/src/content/     contenido editorial (guía de PowerTable)
data/                base de datos persistente (generada por el pipeline)
data/translations/   traducciones guardadas (se aplican solo si el texto original no ha cambiado)
```

## Categorías

Data Factory · Data Engineering · Data Science · Data Warehouse · Real-Time Intelligence · Power BI · OneLake · Direct Lake · Data Activator · Copilot e Inteligencia Artificial · Administración y gobernanza · Seguridad · Integraciones y conectores · APIs y herramientas para desarrolladores · Bases de datos (SQL database, Cosmos DB) · Plataforma Fabric (anuncios transversales).
