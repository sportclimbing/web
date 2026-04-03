<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>

  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <title>ifsc.stream Sitemap</title>
        <style>
          :root {
            color-scheme: light dark;
          }
          body {
            margin: 0;
            font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
            line-height: 1.45;
            background: #f5f7fb;
            color: #1f2937;
          }
          .wrap {
            max-width: 1100px;
            margin: 32px auto;
            padding: 0 16px;
          }
          .card {
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.06);
          }
          .header {
            padding: 20px 24px;
            border-bottom: 1px solid #e5e7eb;
            background: linear-gradient(135deg, #ffffff 0%, #eef6ff 100%);
          }
          h1 {
            margin: 0 0 6px 0;
            font-size: 1.35rem;
            font-weight: 700;
          }
          p {
            margin: 0;
            color: #4b5563;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          thead th {
            position: sticky;
            top: 0;
            background: #f9fafb;
            z-index: 1;
            text-align: left;
            font-size: 0.8rem;
            letter-spacing: 0.04em;
            text-transform: uppercase;
            color: #6b7280;
            border-bottom: 1px solid #e5e7eb;
            padding: 12px 16px;
          }
          tbody td {
            border-bottom: 1px solid #eef2f7;
            padding: 10px 16px;
            vertical-align: top;
            font-size: 0.92rem;
          }
          tbody tr:hover {
            background: #f8fbff;
          }
          td.loc a {
            color: #0f4c81;
            text-decoration: none;
            word-break: break-all;
          }
          td.loc a:hover {
            text-decoration: underline;
          }
          td.small {
            white-space: nowrap;
            color: #374151;
            width: 1%;
          }
          @media (max-width: 780px) {
            .header {
              padding: 16px;
            }
            tbody td,
            thead th {
              padding: 10px 12px;
            }
          }
        </style>
      </head>
      <body>
        <div class="wrap">
          <div class="card">
            <div class="header">
              <h1>ifsc.stream Sitemap</h1>
              <p>
                URL count:
                <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong>
              </p>
            </div>
            <table>
              <thead>
                <tr>
                  <th>URL</th>
                  <th>Changefreq</th>
                  <th>Priority</th>
                </tr>
              </thead>
              <tbody>
                <xsl:for-each select="sitemap:urlset/sitemap:url">
                  <tr>
                    <td class="loc">
                      <a>
                        <xsl:attribute name="href"><xsl:value-of select="sitemap:loc"/></xsl:attribute>
                        <xsl:value-of select="sitemap:loc"/>
                      </a>
                    </td>
                    <td class="small">
                      <xsl:value-of select="sitemap:changefreq"/>
                    </td>
                    <td class="small">
                      <xsl:value-of select="sitemap:priority"/>
                    </td>
                  </tr>
                </xsl:for-each>
              </tbody>
            </table>
          </div>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
