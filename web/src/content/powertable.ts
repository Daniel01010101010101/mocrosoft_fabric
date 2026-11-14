/**
 * Guía completa de PowerTable (Planning en Fabric IQ), redactada en español a partir de la
 * documentación oficial de Microsoft Learn. Cada sección enlaza a sus fuentes.
 * Los nombres de botones y opciones se mantienen en inglés, tal como aparecen en el producto.
 */

const LEARN = 'https://learn.microsoft.com/es-es/fabric/iq/plan/';

export type GuideBlock =
  | { kind: 'p'; text: string }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'steps'; items: { title: string; detail: string }[] }
  | { kind: 'table'; columns: string[]; rows: string[][] }
  | { kind: 'callout'; tone: 'tip' | 'warning' | 'info'; title: string; text: string }
  | { kind: 'cards'; items: { title: string; text: string }[] }
  | { kind: 'calc' }
  | { kind: 'sources'; links: { label: string; url: string }[] };

export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  summary: string;
  blocks: GuideBlock[];
}

export const POWERTABLE_FACTS = [
  'Parte de Planning en Fabric IQ',
  'Sin código, con experiencia tipo Excel',
  'Lee y escribe en Fabric SQL database',
  'Seguridad, aprobaciones y auditoría',
  'Disponible en todas las regiones de Fabric',
];

/** Términos para detectar automáticamente novedades relacionadas con PowerTable. */
export const POWERTABLE_PATTERN =
  /\bpower ?tables?\b|planning in fabric|fabric planning|planning sheets?|intelligence sheets?|infobridge|fabric iq plan|\bplan items?\b|lumel/i;

export const POWERTABLE_GUIDE: GuideSection[] = [
  {
    id: 'que-es',
    title: '¿Qué es PowerTable?',
    icon: 'Lightbulb',
    summary: 'La pieza de Planning en Fabric IQ para crear aplicaciones de datos sin código sobre Fabric SQL database.',
    blocks: [
      {
        kind: 'p',
        text: 'PowerTable (en el producto, «PowerTable sheets») es una plataforma sin código para gestionar datos maestros y de referencia y crear aplicaciones de productividad dentro de Microsoft Fabric. Permite construir «table apps» colaborativas, con una experiencia de edición parecida a Excel, pero con el gobierno de una plataforma empresarial: permisos, aprobaciones, auditoría y sincronización en vivo con la base de datos.',
      },
      {
        kind: 'p',
        text: 'Forma parte de Planning en Fabric IQ, la solución de gestión del rendimiento empresarial (EPM/CPM) integrada en Fabric. Planning reúne cuatro componentes: Planning sheets (presupuestos, previsiones y escenarios), PowerTable sheets (gestión de datos y aplicaciones), Intelligence sheets (informes y análisis de desviaciones) e Infobridge (integración de datos entre sistemas).',
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'La idea clave',
        text: 'PowerTable trabaja directamente sobre una tabla de una Fabric SQL database: lee de ella y escribe en ella cada cambio que guardas. Un semantic model solo puede usarse para cargar los datos iniciales; PowerTable nunca modifica el semantic model ni su origen.',
      },
      {
        kind: 'cards',
        items: [
          { title: 'Construir sin código', text: 'Apps de tabla al instante desde la base de datos, editor tipo Excel, formularios, filtros, vistas personalizadas, búsquedas (lookups) y columnas calculadas.' },
          { title: 'Colaborar', text: 'Edición simultánea, flujos de aprobación, comentarios con @menciones e hilos, notificaciones por correo y Microsoft Teams, marcadores compartibles.' },
          { title: 'Planificar y ejecutar', text: 'Diagramas de Gantt, vistas de recursos, Kanban y calendario, seguimiento de tareas y automatizaciones con disparadores.' },
          { title: 'Controlar y auditar', text: 'Permisos empresariales, historial completo de cambios, seguridad por filas y columnas, soporte de SCD tipo 2 e integración con OneLake.' },
        ],
      },
      {
        kind: 'p',
        text: 'Su origen está en Lumel PowerTable, una solución del ecosistema de Fabric que el roadmap oficial marcó como disponible de forma general en el tercer trimestre de 2025. Hoy está integrada como PowerTable sheets dentro de Planning, disponible en todo el mundo como parte del SKU de Microsoft Fabric.',
      },
      {
        kind: 'sources',
        links: [
          { label: '¿Qué es planning en Fabric?', url: `${LEARN}overview` },
          { label: '¿Qué son las PowerTable sheets?', url: `${LEARN}powertable-overview` },
        ],
      },
    ],
  },
  {
    id: 'casos-de-uso',
    title: 'Para qué usarlo',
    icon: 'Target',
    summary: 'Escenarios en los que PowerTable aporta más valor.',
    blocks: [
      {
        kind: 'cards',
        items: [
          { title: 'Datos maestros y de referencia', text: 'Catálogos de productos, centros de coste, jerarquías, tablas de mapeo y equivalencias que hoy viven en hojas de Excel sin control.' },
          { title: 'Captura estructurada de datos', text: 'Formularios para solicitudes internas, gastos, encuestas, altas de proveedores u onboarding, escribiendo directamente en la base de datos.' },
          { title: 'Inventarios y activos', text: 'Gestión de activos con estados, responsables y ubicaciones, como en el tutorial oficial de Northwind (activos de TI).' },
          { title: 'Proyectos y tareas', text: 'Planificación con Gantt (dependencias, hitos, ruta crítica), asignación de recursos, Kanban y calendario.' },
          { title: 'Cambios con aprobación', text: 'Datos sensibles (precios, límites, presupuestos) que deben revisarse antes de llegar a la base de datos.' },
          { title: 'Planificación conectada', text: 'Tablas que alimentan los planes de presupuesto o previsión: un cambio en PowerTable fluye hacia los planes conectados.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: 'Empieza por un caso acotado',
        text: 'El mejor primer proyecto es una hoja de Excel compartida y crítica que hoy genera errores o versiones duplicadas: un catálogo maestro, una tabla de mapeos o un inventario. Es fácil de medir y demuestra valor rápido.',
      },
    ],
  },
  {
    id: 'requisitos',
    title: 'Requisitos previos',
    icon: 'ListChecks',
    summary: 'Lo que debe estar listo antes de crear tu primera app.',
    blocks: [
      {
        kind: 'steps',
        items: [
          { title: 'Capacidad compatible', detail: 'Una capacidad de Microsoft Fabric (SKU F) o Power BI Premium (P1 o superior). Power BI Pro y Premium Per User (PPU) no son compatibles con los escenarios que usan el endpoint XMLA, y algunos SKU pequeños pueden quedarse cortos de memoria.' },
          { title: 'Configuración del tenant (administrador)', detail: 'En OneLake catalog > Govern > Configurations > Tenant settings: activar «Allow XMLA endpoints and Analyze in Excel with on-premises semantic models» (Integration settings). Si usarás service principals, activar también «Service principals can call Fabric public APIs» (Developer settings).' },
          { title: 'Endpoint XMLA de la capacidad', detail: 'En OneLake catalog > Govern > Capacities, configurar «XMLA Endpoint» como Read Only o Read Write.' },
          { title: 'Quién puede usar Planning', detail: 'Revisar los tenant settings de Planning: «Users can upgrade to a Planner session», «Users can upgrade to a Stakeholder session» (para toda la organización o grupos de seguridad concretos) y «Show Oversubscription Warning».' },
          { title: 'Permisos en el workspace', detail: 'Necesitas al menos el rol Contributor para crear el elemento Plan y la Fabric SQL database.' },
          { title: 'Una Fabric SQL database', detail: 'PowerTable lee y escribe en una Fabric SQL database. Créala antes que la app. Al crearla verás también un SQL analytics endpoint con el mismo nombre: es normal y PowerTable no lo usa.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Situaciones no compatibles',
        text: 'Los workspaces con Private Link a nivel de workspace no admiten elementos Plan (el Private Link a nivel de tenant sí). No renombres un workspace que contenga un Plan: deja de abrirse.',
      },
      {
        kind: 'sources',
        links: [
          { label: 'Requisitos previos de planning', url: `${LEARN}overview-prerequisites` },
          { label: 'Limitaciones conocidas', url: `${LEARN}overview-limitations` },
          { label: 'Preguntas frecuentes de PowerTable', url: `${LEARN}resources/powertable-general-faq` },
        ],
      },
    ],
  },
  {
    id: 'costes',
    title: 'Licencias, roles y costes',
    icon: 'Wallet',
    summary: 'Se paga por sesiones activas de 30 días que consumen capacidad, no por licencias fijas.',
    blocks: [
      {
        kind: 'p',
        text: 'Planning usa un modelo por sesiones: no compras licencias por usuario, sino que cada usuario activo abre una sesión de 30 días que consume unidades de capacidad (CU) de tu capacidad de Fabric. El rol de la sesión depende de lo que hace la persona, y se asigna automáticamente.',
      },
      {
        kind: 'table',
        columns: ['Rol', 'Qué puede hacer', 'Consumo por sesión de 30 días'],
        rows: [
          ['Planner', 'Crea y administra modelos de planificación (planning sheets), reglas de negocio y estructuras.', '847 CU-hora'],
          ['Stakeholder', 'Introduce y aprueba datos, colabora, crea y edita apps de PowerTable, informes y análisis.', '168 CU-hora'],
          ['Viewer', 'Consulta en solo lectura con filtros, ordenación y marcadores.', '37 CU-hora'],
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Importante para PowerTable',
        text: 'Crear o editar PowerTable sheets se considera actividad de Stakeholder: no sube la sesión a Planner. Solo crear o editar planning sheets la convierte en Planner.',
      },
      {
        kind: 'list',
        items: [
          'Una sesión empieza al abrir, crear o editar un elemento Plan y dura 730 horas (30 días); no se puede terminar antes.',
          'Se cuenta por combinación de tenant + usuario + capacidad: trabajar en dos capacidades genera dos sesiones.',
          'Si el rol sube (Viewer → Stakeholder → Planner) la sesión anterior se prorratea; no se puede bajar de rol dentro de una sesión.',
          'Cada automatización completada con éxito consume 2 CU; las fallidas no se cobran.',
          'Reserva aproximadamente un 30 % adicional de capacidad para Fabric SQL, OneLake y operaciones XMLA.',
          'Si la capacidad está saturada (throttling), no se pueden crear sesiones nuevas ni subir de rol; las sesiones existentes siguen funcionando.',
        ],
      },
      { kind: 'calc' },
      {
        kind: 'sources',
        links: [
          { label: 'Facturación y uso de planning', url: `${LEARN}resources/billing-fabric-plan` },
          { label: 'Roles en planning', url: `${LEARN}overview-roles` },
          { label: 'Throttling de capacidad', url: `${LEARN}capacity-throttling` },
          { label: 'Estimador de capacidad de Fabric Planning', url: 'https://community.fabricplan.com/capacity-pricing/' },
        ],
      },
    ],
  },
  {
    id: 'primeros-pasos',
    title: 'Tu primera app, paso a paso',
    icon: 'Rocket',
    summary: 'El recorrido completo desde cero, siguiendo el tutorial oficial (30-45 minutos).',
    blocks: [
      {
        kind: 'steps',
        items: [
          { title: 'Prepara el workspace', detail: 'Usa un workspace en una capacidad F o P y comprueba que tienes rol Contributor o superior. Para practicar, crea un workspace de pruebas.' },
          { title: 'Crea la base de datos', detail: 'New item > busca «SQL» > SQL database. Ponle un nombre claro (p. ej. fabric_plan_maestros): lo elegirás cada vez que crees una hoja de PowerTable.' },
          { title: 'Crea el elemento Plan', detail: 'New item > busca «Plan» > Plan. El nombre es solo una etiqueta, pero usa uno consistente para encontrarlo después.' },
          { title: 'Añade una hoja de PowerTable', detail: 'En la pantalla de bienvenida del Plan selecciona PowerTable, escribe el nombre de la hoja y pulsa Create.' },
          { title: 'Configura la conexión (una sola vez)', detail: 'Pulsa Set up connection > Create Connection, con Authentication kind = Organizational account. Se hace una vez por Plan y es lo que permite que los usuarios con rol Viewer en el workspace trabajen con la app.' },
          { title: 'Crea la app', detail: 'Pulsa Create a New App (o Explore PowerTable si quieres ver primero una app de ejemplo con datos de muestra). Elige la conexión, en Select Database From marca Database Item y selecciona tu base de datos.' },
          { title: 'Elige el origen de los datos', detail: 'New Table para crear una tabla nueva (subiendo Excel/CSV, introduciendo datos a mano o desde un semantic model) o Existing Table para conectar una tabla que ya existe.' },
          { title: 'Configura la tabla', detail: 'Revisa la clave primaria, marca la Identity Column si quieres numeración automática, los campos Mandatory y Unique Key, tipos de datos y Display Name. Decide aquí si activas Slowly Changing Dimensions: no podrás cambiarlo después. Pulsa Finish y luego Save.' },
          { title: 'Da forma a las columnas', detail: 'En cada columna (… > Edit) elige el Input Type adecuado: Single Select con Distinct Values o Lookup a otra tabla, Image, Person, Currency, Date time… Pon nombres visibles en español y añade reglas de formato condicional.' },
          { title: 'Añade columnas calculadas', detail: 'Insert Column > Formula Column, por ejemplo DATEADD([Purchase Date], (365*[Expected Lifetime In Years])). Escribe la fórmula a mano: copiarla y pegarla no funciona.' },
          { title: 'Edita y guarda', detail: 'Edita celdas, inserta filas (o activa Insert Using Form By Default), usa Bulk Edit, Find and Replace o Import. Revisa con Preview Changes y confirma con Save to Database: hasta ese momento nada se escribe en la base de datos.' },
          { title: 'Gobierna, automatiza y comparte', detail: 'Configura permisos y aprobaciones, revisa la auditoría, crea formularios y automatizaciones, y comparte el Plan con los usuarios.' },
        ],
      },
      {
        kind: 'sources',
        links: [
          { label: 'Tutorial: empezar con PowerTable', url: `${LEARN}planning-tutorial/powertable/tutorial-7-get-started-with-powertable` },
          { label: 'Crear una app importando Excel', url: `${LEARN}powertable-how-to-create-table-app` },
          { label: 'Preguntas frecuentes de creación', url: `${LEARN}resources/powertable-sheets-creation-faq` },
        ],
      },
    ],
  },
  {
    id: 'formas-de-crear',
    title: 'Cuatro formas de crear una app',
    icon: 'GitFork',
    summary: 'Cómo elegir el origen de los datos.',
    blocks: [
      {
        kind: 'table',
        columns: ['Método', 'Dónde quedan los datos', 'Cuándo elegirlo'],
        rows: [
          ['Subir Excel o CSV', 'Se crea una tabla nueva en tu Fabric SQL database y la app lee y escribe en ella.', 'Migrar hojas de Excel existentes. Puedes importar solo la estructura y cargar datos después.'],
          ['Conectar a una tabla existente', 'La misma tabla es origen y destino.', 'Cuando los datos ya están en una Fabric SQL database.'],
          ['Introducir datos manualmente', 'Defines las columnas y empiezas con una tabla vacía.', 'Catálogos o registros nuevos que aún no existen en ningún sitio.'],
          ['Conectar a un semantic model', 'El semantic model solo siembra la tabla destino; los cambios se guardan en la Fabric SQL database.', 'Partir de datos ya modelados en Power BI. Usa Refresh > Semantic Model para traer los últimos datos antes de guardar.'],
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Solo Fabric SQL database',
        text: 'Por ahora PowerTable solo se conecta a Fabric SQL databases. Si tus datos están en otro sistema, réplicalos o cópialos primero (por ejemplo con mirroring, Copy job o un pipeline). Para conectar un semantic model, el workspace debe estar en una capacidad Premium o Fabric: los workspaces con licencias Pro no son compatibles.',
      },
      {
        kind: 'sources',
        links: [
          { label: 'Conectar a una base de datos', url: `${LEARN}powertable-how-to-connect-existing-database` },
          { label: 'Conectar a un semantic model', url: `${LEARN}powertable-how-to-connect-semantic-model` },
          { label: 'Introducir datos manualmente', url: `${LEARN}powertable-how-to-enter-table-data-manually` },
        ],
      },
    ],
  },
  {
    id: 'diseno-datos',
    title: 'Diseña bien tus tablas',
    icon: 'Database',
    summary: 'Las decisiones de diseño que más evitan problemas después.',
    blocks: [
      {
        kind: 'list',
        items: [
          'Define una clave primaria estable y bloquéala para edición (Column Access). Para claves compuestas usa Unique Combination.',
          'La Identity Column solo se puede aplicar a columnas numéricas o de clave primaria y no se puede cambiar después: para modificarla tendrías que volver a importar y configurar la tabla.',
          'Los nombres de tablas y columnas solo admiten caracteres en inglés. Usa nombres técnicos en inglés y pon las etiquetas en español en Display Name.',
          'Para textos en español (tildes, ñ, ¿?) define las columnas como NVARCHAR: así PowerTable guarda y muestra correctamente caracteres no ingleses.',
          'Evita el texto libre en campos de clasificación: usa Single Select con Distinct Values o, mejor, un Lookup a una tabla de referencia (como las tablas de empleados y ubicaciones del tutorial).',
          'Marca como Mandatory lo obligatorio y define valores por defecto para agilizar la captura.',
          'Para datos maestros, prefiere el borrado lógico (Setup > Table Settings > Delete settings > Mark as Deleted) al borrado permanente.',
          'Las columnas visuales (relation, rollup, reference, multi-select, button, attachment) no cambian el esquema de la base de datos; las database columns sí.',
          'Decide el historial antes de crear la tabla: SCD tipo 2 guarda una fila por versión (clave sustituta, fechas de vigencia e indicador de activo) y SCD tipo 3 guarda el valor anterior en otra columna. Es una configuración única e irreversible.',
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Consecuencias del SCD',
        text: 'Con SCD tipo 2 la hoja no admite registro de auditoría, y con SCD tipo 3 no se puede usar Revert Changes. Actívalo solo si necesitas ese historial dimensional.',
      },
      {
        kind: 'sources',
        links: [
          { label: 'Tipos de columna y de entrada admitidos', url: `${LEARN}powertable-reference-supported-column-input-types` },
          { label: 'Insertar columnas', url: `${LEARN}powertable-how-to-insert-columns/how-to-insert-columns-introduction` },
          { label: 'Slowly changing dimensions', url: `${LEARN}powertable-concept-slowly-changing-dimensions` },
        ],
      },
    ],
  },
  {
    id: 'editar-datos',
    title: 'Editar y cargar datos',
    icon: 'PencilLine',
    summary: 'Qué método usar para cada tipo de cambio.',
    blocks: [
      {
        kind: 'table',
        columns: ['Método', 'Ideal para', 'Detalles'],
        rows: [
          ['Row Editor (rejilla)', 'Cambios puntuales', 'Edita celdas como en Excel; admite copiar, pegar y rellenar hacia abajo.'],
          ['Form Editor (una fila)', 'Registros con muchas columnas', 'Manage Record abre el formulario con los tipos de entrada configurados.'],
          ['Form Editor (varias filas)', 'Mismo valor en varias filas', 'Solo sustituye los campos que editas; el resto no cambia.'],
          ['Bulk Edit', 'Ajustes calculados', 'Desplaza valores (sumar, restar, multiplicar, dividir, prefijos, sufijos) en las filas seleccionadas.'],
          ['Find and Replace', 'Correcciones masivas de texto', 'Busca y reemplaza en una o varias columnas.'],
          ['Import (Excel/CSV)', 'Cargas masivas', 'Compara por clave primaria: actualiza las coincidencias, inserta las nuevas y marca los errores. Hasta 20.000 filas nuevas por importación.'],
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: 'Nada se guarda hasta Save to Database',
        text: 'Pulsar Apply en un formulario solo deja el cambio pendiente. Revisa con Preview Changes, deshaz con Discard Changes y confirma con Save to Database. Insert Multiple Rows admite hasta 1.000 filas a la vez y, al duplicar filas, recuerda cambiar la clave primaria.',
      },
      {
        kind: 'sources',
        links: [{ label: 'Insertar, importar, duplicar y borrar filas', url: `${LEARN}powertable-how-to-insert-rows-import-data` }],
      },
    ],
  },
  {
    id: 'seguridad',
    title: 'Seguridad y gobierno',
    icon: 'ShieldCheck',
    summary: 'Permisos, seguridad por filas, aprobaciones y auditoría.',
    blocks: [
      {
        kind: 'p',
        text: 'PowerTable ofrece dos modelos de seguridad, que se eligen por base de datos desde Security en la barra de herramientas. Si activas Roles & Policies, sustituye a la configuración de Manage Access.',
      },
      {
        kind: 'table',
        columns: ['Modelo', 'Qué controla', 'Cuándo usarlo'],
        rows: [
          ['Manage Access (Legacy, por defecto)', 'Quién puede añadir, actualizar o borrar filas (nadie, todos, usuarios concretos o por reglas) y quién puede editar cada columna.', 'Apps sencillas con pocos perfiles.'],
          ['Roles & Policies Security', 'Políticas con reglas por tabla (Read, Insert, Update, Delete + filtros), roles y asignación de usuarios. Permite seguridad por filas (RLS) estática y dinámica.', 'Cuando cada usuario debe ver o editar solo sus datos (por región, departamento, cartera…).'],
        ],
      },
      {
        kind: 'list',
        items: [
          'RLS dinámica: crea User Attributes que relacionen el email del usuario (Logged in User) con los valores que puede ver, y úsalos en las reglas con el operador Is One Of.',
          'El rol Item Baseline da acceso completo por defecto a quien no tenga otro rol: restríngelo con Restrict with Policy.',
          'Bypass Mode da acceso total a todas las tablas: resérvalo para administradores de confianza y desactívalo cuando ya no haga falta.',
          'Si un usuario tiene varios roles, los permisos se suman y prevalece el acceso más alto.',
          'El permiso Insert no se combina con Read, Update o Delete en la misma regla: crea reglas separadas.',
          'Bloquea la edición de la clave primaria y de las columnas sensibles en Column Access.',
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'Aprobaciones',
        text: 'Con PowerTable > Approvals > Requires Approval for All Changes, el botón Save to Database pasa a ser Submit for Review y cada cambio espera aprobación. Los aprobadores pueden ser usuarios o grupos de Microsoft Entra, o asignarse por reglas (con un aprobador por defecto para lo que no cumpla ninguna regla). Admite hasta tres niveles de aprobación y avisa por Microsoft Teams.',
      },
      {
        kind: 'list',
        items: [
          'Auditoría (PowerTable > Audit): pestañas Data, Access y Table con quién cambió qué y cuándo, incluido el aprobador. Se puede filtrar y exportar a Excel.',
          'Revert Changes deshace actualizaciones (solo acciones UPDATE) y queda registrado.',
          'Writeback Logs muestra cada operación de escritura (estado, filas, duración, usuario).',
          'Last Updated Details añade a la tabla las columnas Last Edited At y Last Edited By.',
          'Roles de workspace recomendados: Viewer para consumidores; Viewer, Contributor o Member para Stakeholders; Admin, Member o Contributor para Planners.',
        ],
      },
      {
        kind: 'sources',
        links: [
          { label: 'Seguridad con roles y políticas', url: `${LEARN}powertable-how-to-configure-security-settings` },
          { label: 'Control de acceso por filas y columnas', url: `${LEARN}powertable-how-to-set-up-access-control` },
          { label: 'Flujos de aprobación', url: `${LEARN}powertable-how-to-configure-approval-workflow` },
          { label: 'Registros de auditoría', url: `${LEARN}powertable-how-to-view-audit-logs` },
        ],
      },
    ],
  },
  {
    id: 'automatizaciones',
    title: 'Automatizaciones',
    icon: 'Zap',
    summary: 'Reglas que ejecutan acciones solas cuando ocurre algo en los datos.',
    blocks: [
      {
        kind: 'p',
        text: 'Una automatización tiene un disparador, una o varias acciones y, opcionalmente, lógica (grupos condicionales o repetitivos). Se crea en Setup > Automations sobre la tabla de la hoja.',
      },
      {
        kind: 'table',
        columns: ['Elemento', 'Opciones'],
        rows: [
          ['Disparadores', 'Registro creado, actualizado o borrado; formulario enviado; botón pulsado. Se pueden añadir condiciones (por ejemplo, solo si cambia un campo concreto).'],
          ['Acciones de datos', 'Create Record, Update Record, Delete Record, Find Record(s), Bulk Create Records y Execute Stored Procedure.'],
          ['Acciones en Fabric', 'Ejecutar pipelines, notebooks o dataflows, refrescar un semantic model y Clear semantic data cache para que los planes vean los datos nuevos.'],
          ['Notificaciones', 'Integración con Microsoft Teams para avisar a los usuarios.'],
          ['Lógica', 'Conditional Group (si / si no) y Repeating Group (repite acciones para cada registro encontrado).'],
        ],
      },
      {
        kind: 'callout',
        tone: 'warning',
        title: 'Límites que conviene conocer',
        text: 'Find Record(s) devuelve como máximo 1.000 registros y un Repeating Group procesa como máximo 1.000. Las cadenas de automatizaciones solo llegan a 2 niveles. Los disparadores de base de datos solo se ejecutan si se escriben 10 registros o menos por tipo de disparador: con más, no se dispara ninguna. Cada ejecución correcta consume 2 CU.',
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: 'Primera automatización recomendada',
        text: 'Un botón en cada fila (Insert Column > Visual Column > Add Button Column) que ejecute una automatización «When a button is clicked», como el ejemplo oficial «Retire Asset», que marca un activo como retirado y lo mueve al almacén. Revisa siempre Run History para comprobar cada paso.',
      },
      {
        kind: 'sources',
        links: [
          { label: 'Concepto de automatización', url: `${LEARN}powertable-concept-automation` },
          { label: 'Configurar automatizaciones', url: `${LEARN}powertable-how-to-create-automation/how-to-configure-automation-workflows` },
          { label: 'Tutorial: aprobaciones, permisos y automatizaciones', url: `${LEARN}planning-tutorial/powertable/tutorial-8-set-up-approvals-access-controls-automations` },
        ],
      },
    ],
  },
  {
    id: 'vistas',
    title: 'Vistas, formularios y colaboración',
    icon: 'LayoutGrid',
    summary: 'Formas de presentar y capturar los datos.',
    blocks: [
      {
        kind: 'cards',
        items: [
          { title: 'Hierarchy y Crosstab', text: 'Agrupa en jerarquías o crea vistas de tabla cruzada para analizar y editar por dimensiones.' },
          { title: 'Gantt', text: 'Tareas con fechas, progreso, hitos, dependencias (FS, SS, FF, SF), ruta crítica y responsables. Hasta 30.000 filas.' },
          { title: 'Resource y Calendar', text: 'Carga de trabajo por persona o recurso y vista de calendario de tareas.' },
          { title: 'Kanban', text: 'Tarjetas por estado que se arrastran entre columnas. Requiere campos de ID, nombre de tarea y campo de agrupación.' },
          { title: 'Formularios', text: 'Setup > Forms genera un formulario con pestañas, grupos, campos obligatorios y logotipo. Se comparte con enlaces que caducan. Solo crea registros nuevos.' },
          { title: 'Colaboración', text: 'Comentarios con @menciones e hilos, formato condicional, exportación a Excel y PDF y marcadores compartibles.' },
        ],
      },
      {
        kind: 'sources',
        links: [
          { label: 'Formularios', url: `${LEARN}powertable-how-to-generate-forms` },
          { label: 'Diseño Gantt', url: `${LEARN}powertable-concept-gantt` },
          { label: 'Diseño Kanban', url: `${LEARN}powertable-layouts/how-to-configure-kanban-layout` },
        ],
      },
    ],
  },
  {
    id: 'integracion',
    title: 'Integración con Fabric y Power BI',
    icon: 'Workflow',
    summary: 'Cómo fluyen los datos de PowerTable hacia la analítica y la planificación.',
    blocks: [
      {
        kind: 'steps',
        items: [
          { title: 'Fabric SQL database', detail: 'Cada Save to Database escribe en la tabla de tu Fabric SQL database.' },
          { title: 'Réplica en OneLake', detail: 'La base de datos se replica automáticamente en OneLake casi en tiempo real.' },
          { title: 'Direct Lake y Power BI', detail: 'Un semantic model en modo Direct Lake lee esos datos desde OneLake para tus informes. Los cambios de esquema pueden requerir refrescar el modelo.' },
          { title: 'Planning sheets', detail: 'Una planning sheet puede usar la tabla directamente (Data > From Sheets) y ver los registros nuevos en cuanto se guardan, o a través de un modelo Direct Lake con un breve retraso.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'tip',
        title: 'Datos siempre al día en los planes',
        text: 'Añade la acción Clear semantic data cache a una automatización que se dispare al crear o actualizar registros: las planning sheets leerán los valores nuevos sin refresco manual.',
      },
    ],
  },
  {
    id: 'limites',
    title: 'Límites importantes',
    icon: 'Gauge',
    summary: 'Cifras clave según la documentación oficial (pueden variar con la capacidad).',
    blocks: [
      {
        kind: 'table',
        columns: ['Concepto', 'Límite'],
        rows: [
          ['Columnas en cargas masivas', '1.022 (la base de datos admite 1.024; 2 son internas)'],
          ['Filas nuevas por importación', '20.000'],
          ['Filas insertadas de una vez', '1.000'],
          ['Ordenar, agrupar, Insight, Find and Replace y barra de desplazamiento', 'Hasta 5 millones de filas'],
          ['Gantt y Resource', 'Hasta 30.000 filas'],
          ['Exportar a Excel', '20 millones de celdas o 1 millón de filas (modo Raw); 5 millones de celdas (modo Label)'],
          ['Hojas por elemento Plan', '25'],
          ['Find Record(s) / Repeating Group', '1.000 registros'],
          ['Cadena de automatizaciones', '2 niveles'],
          ['Disparadores de base de datos', '10 registros escritos por tipo de disparador'],
        ],
      },
      { kind: 'sources', links: [{ label: 'Limitaciones conocidas de planning', url: `${LEARN}overview-limitations` }] },
    ],
  },
  {
    id: 'errores',
    title: 'Errores frecuentes y cómo evitarlos',
    icon: 'TriangleAlert',
    summary: 'Lo que más problemas causa al empezar.',
    blocks: [
      {
        kind: 'table',
        columns: ['Error', 'Cómo evitarlo'],
        rows: [
          ['Trabajar en un workspace Pro o PPU', 'Usa una capacidad F o Premium P1+ con el endpoint XMLA activado.'],
          ['Saltarse Set up connection', 'Configúrala al crear el Plan: sin ella los usuarios Viewer no pueden trabajar con la app.'],
          ['Nombres de columnas con tildes o ñ', 'Nombres técnicos en inglés y etiquetas en español en Display Name.'],
          ['Texto en español en columnas VARCHAR', 'Usa NVARCHAR para que tildes y ñ se guarden bien.'],
          ['Elegir mal la clave o activar SCD sin pensarlo', 'Son decisiones irreversibles: diséñalas antes de pulsar Finish.'],
          ['Creer que se actualiza el semantic model', 'PowerTable escribe en la Fabric SQL database, nunca en el modelo ni en su origen.'],
          ['Dejar abierto el rol Item Baseline', 'Al activar Roles & Policies, restríngelo con Restrict with Policy.'],
          ['Olvidar Bypass Mode activado', 'Úsalo solo de forma temporal y para administradores.'],
          ['Copiar y pegar fórmulas', 'Escríbelas a mano en el editor de fórmulas.'],
          ['Pensar que Apply guarda', 'Solo Save to Database escribe en la base de datos.'],
          ['No dimensionar la capacidad', 'Estima sesiones (no se pueden cancelar) y deja margen para evitar throttling.'],
          ['Renombrar el workspace o el semantic model conectado', 'Rompe el Plan: elige nombres definitivos desde el principio.'],
        ],
      },
    ],
  },
  {
    id: 'plan-implantacion',
    title: 'Plan de implantación por fases',
    icon: 'Route',
    summary: 'Una forma ordenada de pasar de la prueba a producción.',
    blocks: [
      {
        kind: 'steps',
        items: [
          { title: 'Fase 0 · Preparación (1 semana)', detail: 'Elige un caso de uso acotado y su responsable de negocio. Revisa capacidad, tenant settings y endpoint XMLA. Estima el coste de sesiones y define los grupos de seguridad de Microsoft Entra.' },
          { title: 'Fase 1 · Piloto (2-3 semanas)', detail: 'En un workspace de desarrollo, prueba Explore PowerTable y el tutorial de Northwind. Construye tu app con 1-3 tablas cuidando el diseño (clave, NVARCHAR, lookups, etiquetas en español) y valídala con 3-5 usuarios clave.' },
          { title: 'Fase 2 · Gobierno', detail: 'Configura permisos (Roles & Policies si necesitas RLS), aprobaciones para los datos sensibles, borrado lógico, auditoría y formularios de captura.' },
          { title: 'Fase 3 · Automatización e integración', detail: 'Añade automatizaciones y notificaciones de Teams, conecta los datos a Power BI (Direct Lake) o a tus planes, y prepara Git y deployment pipelines.' },
          { title: 'Fase 4 · Producción y operación', detail: 'Despliega en el workspace de producción, forma a los usuarios, supervisa el consumo con la app Capacity Metrics (la facturación se calcula por capacidad), revisa la auditoría y ajusta permisos y capacidad cada mes.' },
        ],
      },
      {
        kind: 'callout',
        tone: 'info',
        title: 'CI/CD',
        text: 'Los elementos Plan admiten integración con Git y deployment pipelines, incluida la creación de la base de datos de la aplicación con service principal. Revisa y confirma en Git los cambios de referencia del semantic model antes de mover elementos entre workspaces.',
      },
    ],
  },
];

export const POWERTABLE_CHECKLIST: { group: string; items: string[] }[] = [
  {
    group: 'Plataforma',
    items: [
      'Capacidad F o Premium P1+ asignada al workspace',
      'Endpoint XMLA en Read Only o Read Write',
      'Tenant settings de Planning revisados (Planner, Stakeholder, aviso de sobresuscripción)',
      'Coste de sesiones estimado y margen de capacidad reservado',
    ],
  },
  {
    group: 'Datos',
    items: [
      'Fabric SQL database creada con nombre definitivo',
      'Set up connection configurada en el Plan',
      'Clave primaria e Identity Column decididas',
      'Columnas de texto en español como NVARCHAR y Display Names en español',
      'Lookups a tablas de referencia en lugar de texto libre',
      'Decisión sobre SCD tomada antes de crear la tabla',
      'Borrado lógico configurado para datos maestros',
    ],
  },
  {
    group: 'Seguridad y gobierno',
    items: [
      'Modelo de seguridad elegido (Manage Access o Roles & Policies)',
      'Rol Item Baseline restringido si usas Roles & Policies',
      'Clave primaria y columnas sensibles bloqueadas',
      'Aprobaciones activadas para datos sensibles, con aprobador por defecto',
      'Auditoría revisada y proceso de revisión periódica definido',
    ],
  },
  {
    group: 'Operación',
    items: [
      'Automatizaciones probadas con Run History',
      'Usuarios formados en el ciclo Preview Changes → Save to Database',
      'Consumo supervisado con Capacity Metrics',
      'Git o deployment pipelines configurados para pasar a producción',
    ],
  },
];

export const POWERTABLE_FAQ: { q: string; a: string }[] = [
  { q: '¿Necesito saber SQL o programar?', a: 'No. PowerTable es sin código: tablas, columnas, permisos, formularios y automatizaciones se configuran desde la interfaz. Saber SQL ayuda para diseñar bien las tablas, pero no es imprescindible.' },
  { q: '¿Dónde se guardan los datos?', a: 'En una tabla de una Fabric SQL database de tu workspace. Desde ahí se replican a OneLake y pueden usarse en Power BI y en Planning.' },
  { q: 'Si parto de un semantic model, ¿mis cambios lo modifican?', a: 'No. El semantic model solo siembra la tabla inicial. Todos los cambios posteriores se escriben en la Fabric SQL database, sin importar el modo de almacenamiento del modelo (Import, DirectQuery o Direct Lake).' },
  { q: '¿Qué permisos necesito para empezar?', a: 'Al menos el rol Contributor en el workspace para crear el elemento Plan y la Fabric SQL database, y que el administrador permita sesiones de Stakeholder para quienes vayan a crear o editar apps.' },
  { q: '¿Puedo conectar SQL Server, Oracle u otra base de datos?', a: 'Directamente no: por ahora solo Fabric SQL database. Replica o copia esos datos a una Fabric SQL database (por ejemplo con mirroring o Copy job) y conecta PowerTable a esa copia.' },
  { q: '¿Cuánto cuesta?', a: 'No hay licencias por usuario: cada persona activa consume una sesión de 30 días de tu capacidad de Fabric (Viewer 37, Stakeholder 168 o Planner 847 CU-hora). Crear y editar apps de PowerTable cuenta como Stakeholder. Usa la calculadora de esta guía y el estimador oficial.' },
  { q: '¿Puedo deshacer un cambio?', a: 'Sí, desde la auditoría con Revert Changes, que deshace actualizaciones (UPDATE) y deja constancia. Antes de guardar, también puedes usar Discard Changes.' },
  { q: '¿Pueden usarlo personas que no están en el workspace?', a: 'Sí, compartiendo el elemento Plan (item sharing). Para escenarios de planning con semantic model, primero hay que darles acceso de lectura y escritura al modelo.' },
  { q: '¿Funciona en español?', a: 'Los datos sí: usa NVARCHAR para el texto en español y Display Name para mostrar etiquetas de columnas en español. Los nombres internos de tablas y columnas deben usar caracteres en inglés.' },
  { q: '¿Cuántos datos aguanta?', a: 'Funciones como ordenar o agrupar llegan hasta 5 millones de filas y las importaciones admiten 20.000 filas nuevas por vez. Consulta la sección de límites; dependen también de tu capacidad.' },
];

export const POWERTABLE_RESOURCES: { label: string; url: string; note: string }[] = [
  { label: '¿Qué es planning en Fabric?', url: `${LEARN}overview`, note: 'Visión general de Planning en Fabric IQ' },
  { label: 'PowerTable sheets: introducción', url: `${LEARN}powertable-overview`, note: 'Capacidades principales' },
  { label: 'Tutorial parte 7: empezar con PowerTable', url: `${LEARN}planning-tutorial/powertable/tutorial-7-get-started-with-powertable`, note: 'App de gestión de activos paso a paso' },
  { label: 'Tutorial parte 8: aprobaciones, permisos y automatizaciones', url: `${LEARN}planning-tutorial/powertable/tutorial-8-set-up-approvals-access-controls-automations`, note: 'Gobierno y automatización' },
  { label: 'Requisitos previos', url: `${LEARN}overview-prerequisites`, note: 'Tenant y capacidad' },
  { label: 'Facturación y uso', url: `${LEARN}resources/billing-fabric-plan`, note: 'Sesiones y consumo de CU' },
  { label: 'Seguridad con roles y políticas', url: `${LEARN}powertable-how-to-configure-security-settings`, note: 'RLS estática y dinámica' },
  { label: 'Limitaciones conocidas', url: `${LEARN}overview-limitations`, note: 'Límites actualizados' },
  { label: 'Preguntas frecuentes de PowerTable', url: `${LEARN}resources/powertable-general-faq`, note: 'Permisos y base de datos' },
];

/** Consumo de capacidad por sesión de 30 días (CU-hora), según la documentación oficial. */
export const SESSION_CU_HOURS = { planner: 847, stakeholder: 168, viewer: 37 } as const;
export const HOURS_PER_SESSION = 730;
