import { describe, expect, it } from 'vitest';
import { isFabricRelevant, mapAzureUpdates } from '../src/sources/azureUpdates';
import { monthToIso, parseWhatsNew, whatsNewId } from '../src/sources/learnWhatsNew';
import { decodeEntities, parseProducts, parseRoadmapJson, repairJson, roadmapItemUrl } from '../src/sources/roadmap';
import { communityPostId, parseRss } from '../src/sources/rss';

const RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Fabric Updates Blog articles</title>
    <item>
      <title>The next chapter for CI/CD in Fabric Warehouse (Preview)</title>
      <link>https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/The-next-chapter/ba-p/5401222</link>
      <description>&lt;P&gt;Building a data warehouse is &lt;STRONG&gt;software engineering&lt;/STRONG&gt;.&lt;/P&gt;&lt;LI-CODE lang="sql"&gt;SELECT 1;&lt;/LI-CODE&gt;</description>
      <pubDate>Wed, 11 Nov 2026 18:00:00 GMT</pubDate>
      <dc:creator>pradeepsvs</dc:creator>
      <dc:date>2026-11-11T18:00:00Z</dc:date>
    </item>
    <item>
      <title>Second post</title>
      <link>https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Second/ba-p/42</link>
      <description>&lt;p&gt;Hello&lt;/p&gt;</description>
      <pubDate>Mon, 09 Nov 2026 17:00:00 GMT</pubDate>
    </item>
  </channel>
</rss>`;

describe('RSS del blog oficial', () => {
  it('extrae título, enlace, autor, fecha y HTML', () => {
    const items = parseRss(RSS, 'fabric-blog');
    expect(items).toHaveLength(2);
    const first = items[0]!;
    expect(first.id).toBe('cm-5401222');
    expect(first.title).toBe('The next chapter for CI/CD in Fabric Warehouse (Preview)');
    expect(first.author).toBe('pradeepsvs');
    expect(first.publishedAt).toBe('2026-11-11T18:00:00.000Z');
    expect(first.html).toContain('<STRONG>software engineering</STRONG>');
  });

  it('usa el id numérico del mensaje para que el mismo post sea un único registro', () => {
    expect(communityPostId('https://community.fabric.microsoft.com/t5/X/slug-a/ba-p/123')).toBe('cm-123');
    expect(communityPostId('https://community.fabric.microsoft.com/t5/Y/slug-b/ba-p/123')).toBe('cm-123');
  });
});

const WHATS_NEW = `
<h2 id="features-currently-in-preview">Features currently in preview</h2>
<table><thead><tr><th>Feature</th><th>Learn more</th></tr></thead><tbody>
<tr><td><strong>Activator rule management (Preview)</strong></td>
<td><a href="https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Fabric-September-2026-Feature-Summary/ba-p/5325825#community-5325825-mcetoc_52">Activator rule management (Preview)</a> provides a central view. See <a href="../real-time-intelligence/data-activator/activator-introduction">What is Activator?</a>.</td></tr>
<tr><td><strong>Event Schema Registry (Preview)</strong></td><td>Registers schemas for events in Real-Time hub.</td></tr>
</tbody></table>
<h2 id="generally-available-features">Generally available features</h2>
<table><thead><tr><th>Month</th><th>Feature</th><th>Learn more</th></tr></thead><tbody>
<tr><td>September 2026</td><td><strong>Fabric IQ in Microsoft 365 Copilot (Generally Available)</strong></td>
<td><a href="https://community.fabric.microsoft.com/t5/Fabric-Updates-Blog/Bringing-governed-analytics/ba-p/5368918">Fabric IQ</a> answers business questions.</td></tr>
</tbody></table>
<h2 id="community">Community</h2>`;

describe("Microsoft Learn · What's new", () => {
  const detected = '2026-11-12T10:00:00.000Z';
  const items = parseWhatsNew(WHATS_NEW, detected);

  it('lee las dos tablas oficiales', () => {
    expect(items).toHaveLength(3);
    expect(items.filter((i) => i.meta.section === 'preview')).toHaveLength(2);
    expect(items.filter((i) => i.meta.section === 'ga')).toHaveLength(1);
  });

  it('obtiene la fecha del resumen mensual enlazado o de la columna Month', () => {
    const activator = items.find((i) => i.title.startsWith('Activator'))!;
    expect(activator.publishedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(activator.datePrecision).toBe('month');
    expect(activator.docsUrl).toBe('https://learn.microsoft.com/en-us/fabric/real-time-intelligence/data-activator/activator-introduction');
    const ga = items.find((i) => i.meta.section === 'ga')!;
    expect(ga.publishedAt).toBe('2026-09-01T00:00:00.000Z');
    expect(ga.stageHint).toBe('ga');
  });

  it('marca como "detectada" la fecha cuando la fuente no la indica y usa la página como fuente verificable', () => {
    const registry = items.find((i) => i.title.startsWith('Event Schema'))!;
    expect(registry.datePrecision).toBe('detected');
    expect(registry.publishedAt).toBe(detected);
    expect(registry.url).toContain('learn.microsoft.com/en-us/fabric/fundamentals/whats-new#features-currently-in-preview');
  });

  it('genera ids estables por sección y título', () => {
    expect(whatsNewId('preview', 'Event Schema Registry (Preview)')).toBe(whatsNewId('preview', 'event schema registry'));
    expect(whatsNewId('preview', 'X')).not.toBe(whatsNewId('ga', 'X'));
  });

  it('convierte meses en inglés a fecha ISO', () => {
    expect(monthToIso('September 2026')).toBe('2026-09-01T00:00:00.000Z');
    expect(monthToIso('nada')).toBeNull();
  });
});

describe('Roadmap oficial', () => {
  it('repara el JSON de plantilla (caracteres de control y escapes no válidos)', () => {
    const broken = '{"results":[{"FeatureName":"A\\_B","FeatureDescription":"line1\nline2\t•\ttab"}]}';
    const parsed = JSON.parse(repairJson(broken));
    expect(parsed.results[0].FeatureName).toBe('A_B');
    expect(parsed.results[0].FeatureDescription).toBe('line1\nline2\t•\ttab');
  });

  it('normaliza los elementos y omite los no publicados', () => {
    const body = `{"results":[
      {"ReleaseItemID":"4D35-AB","FeatureName":"Oracle connector","ReleaseDate":"Q3 2026","ReleaseType":"General availability","ReleaseStatus":"Planned","ReleaseSemester":"2026 Wave 1 (Rubidium) (Public)","ProductID":"p1","ProductName":"Data Factory","isPublishExternally":"true","FeatureDescription":"Desc"},
      {"ReleaseItemID":"x","FeatureName":"Hidden","isPublishExternally":"false"}
    ]}`;
    const items = parseRoadmapJson(body, { id: 'p1', name: 'Data Factory', query: 'datafactory' });
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      releaseItemId: '4d35-ab',
      product: 'Data Factory',
      releaseDate: 'Q3 2026',
      wave: '2026 Wave 1 (Rubidium)',
    });
    expect(roadmapItemUrl('datafactory', '4d35-ab')).toBe('https://roadmap.fabric.microsoft.com/?product=datafactory&releaseItem=4d35-ab');
  });

  it('decodifica las entidades HTML de los textos', () => {
    expect(decodeEntities('always have a value&quot; &amp; more &#39;x&#39;')).toBe('always have a value" & more \'x\'');
  });

  it('detecta la lista de productos publicada en la página', () => {
    const html = `ProductFamily.id = "abc"; ProductFamily.name = "OneLake"; ProductFamily.queryString = "onelake";`;
    expect(parseProducts(html)).toEqual([{ id: 'abc', name: 'OneLake', query: 'onelake' }]);
  });
});

describe('Azure Updates', () => {
  const base = { products: [] as string[], created: '2026-06-01T00:00:00Z' };
  it('acepta solo novedades del ecosistema Fabric', () => {
    expect(isFabricRelevant({ ...base, title: 'Public Preview: Azure Monitor Logs mirroring into Microsoft Fabric' })).toBe(true);
    expect(isFabricRelevant({ ...base, title: 'Announcing: Table discovery in OneLake Catalog search' })).toBe(true);
    expect(isFabricRelevant({ ...base, title: 'Something', products: ['Microsoft Fabric'] })).toBe(true);
  });
  it('descarta productos homónimos y anuncios anteriores a Fabric', () => {
    expect(isFabricRelevant({ ...base, title: 'Retirement: Service Fabric support for Windows Server 2019' })).toBe(false);
    expect(isFabricRelevant({ ...base, title: 'Hyperledger Fabric on Azure Kubernetes Service' })).toBe(false);
    expect(isFabricRelevant({ ...base, created: '2020-01-01T00:00:00Z', title: 'OneLake' })).toBe(false);
  });
  it('genera enlaces oficiales verificables', () => {
    const [u] = mapAzureUpdates([
      {
        id: '467768',
        title: 'Public Preview: Azure SQL Managed Instance mirroring to Microsoft Fabric',
        description: '<p>Mirror data</p>',
        status: 'In preview',
        created: '2024-11-19T17:00:35Z',
        modified: '2024-11-19T17:00:35Z',
        products: ['Azure SQL Managed Instance'],
        tags: ['Features'],
        generalAvailabilityDate: null,
        previewAvailabilityDate: '2024-11',
      },
    ]);
    expect(u!.url).toBe('https://azure.microsoft.com/en-us/updates?id=467768');
    expect(u!.stageHint).toBe('preview');
  });
});
