// One-time migration script: converts every hand-built `<table kind="compact">`
// in demos/navigate-app.html into a `<vi-grid>` element (the real documented
// EAB data-grid component: @eab-vip/vi-grid), preserving all existing cell
// content exactly (links, buttons, badges) via render_type "html".
//
// Run with: node scripts/convert-tables-to-vi-grid.js
// Safe to re-run: it only touches remaining `<table kind="compact">` blocks.

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const FILE = path.join(__dirname, '..', 'demos', 'navigate-app.html');
let html = fs.readFileSync(FILE, 'utf8');

let gridCounter = 0;

function slug(str, fallback) {
  const s = (str || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return s || fallback;
}

function isCheckboxCell(cellHtml) {
  return /<hi-checkbox/.test(cellHtml || '');
}

function convertTable(tableHtml) {
  const $ = cheerio.load(tableHtml, { xmlMode: false, decodeEntities: false });
  const $table = $('table').first();
  const kindClass = $table.attr('class') || '';

  const headerCells = $table.find('thead tr').first().find('th');
  const headers = [];
  headerCells.each((i, el) => {
    headers.push($(el).html() ? $(el).html().trim() : '');
  });

  // Detect leading checkbox selection column (vi-grid provides this natively)
  let skipFirstCol = false;
  if (headers.length && isCheckboxCell(headers[0])) {
    skipFirstCol = true;
  } else {
    // also check first data row's first cell in case header th is blank but td has checkbox
    const firstRowCells = $table.find('tbody tr').first().find('td');
    if (firstRowCells.length && isCheckboxCell($(firstRowCells[0]).html())) {
      skipFirstCol = true;
    }
  }

  const usableHeaders = skipFirstCol ? headers.slice(1) : headers;
  if (!usableHeaders.length) return null; // nothing to convert (shouldn't happen)

  const fieldKeys = usableHeaders.map((h, i) => {
    const text = h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return slug(text, `col${i}`);
  });
  // de-dupe
  const seen = {};
  fieldKeys.forEach((k, i) => {
    if (seen[k] != null) {
      seen[k] += 1;
      fieldKeys[i] = `${k}_${seen[k]}`;
    } else {
      seen[k] = 0;
    }
  });

  const fields = {};
  fieldKeys.forEach((key, i) => {
    const titleText = usableHeaders[i].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    fields[key] = { title: titleText, render_type: 'html' };
  });

  const rows = [];
  $table.find('tbody tr').each((rowIdx, tr) => {
    const $tds = $(tr).find('td');
    if ($tds.length === 1 && $tds.first().attr('colspan')) {
      // empty-state row like "This user has no upcoming appointments."
      const msg = $($tds[0]).html().trim();
      rows.push({ __emptyMessage: msg });
      return;
    }
    const cells = [];
    $tds.each((i, td) => {
      cells.push($(td).html() != null ? $(td).html().trim() : '');
    });
    const usableCells = skipFirstCol ? cells.slice(1) : cells;
    const row = { id: `row-${++gridCounter}` };
    fieldKeys.forEach((key, i) => {
      row[key] = usableCells[i] != null ? usableCells[i] : '';
    });
    rows.push(row);
  });

  const emptyRow = rows.find((r) => r.__emptyMessage);
  const dataRows = rows.filter((r) => !r.__emptyMessage);

  const gridId = `grid-${++gridCounter}`;
  const typeJson = JSON.stringify({ fields });
  const inputJson = JSON.stringify(dataRows);

  const settings = {
    hidden: {
      export: true,
      add_row: true,
      grid_table: true,
      sort_manager: true,
      column_manager: true,
      settings_manager: true,
      clear_all_limits: true,
      global_search: true,
      pagination_row_size: true,
      auto_fit_column_width: true,
    },
    allow: {
      row_selections: skipFirstCol,
      table_sort: true,
      table_filter: false,
      table_pagination: false,
    },
  };
  if (emptyRow) {
    settings.messages = { state_empty: { title: '', description: emptyRow.__emptyMessage } };
  }
  const settingsJson = JSON.stringify(settings);

  const classAttr = kindClass ? ` class="${kindClass.replace('mt-6', '').trim()}"` : '';
  return `<vi-grid id="${gridId}"${classAttr} settings='${settingsJson}' type='${typeJson}' input='${inputJson}'></vi-grid>`;
}

// Match each <table kind="compact" ...> ... </table> block (non-greedy, handles nesting-free tables)
const tableRegex = /<table\s+kind="compact"[^>]*>[\s\S]*?<\/table>/g;

let count = 0;
html = html.replace(tableRegex, (match) => {
  const replacement = convertTable(match);
  if (replacement) {
    count += 1;
    return replacement;
  }
  return match;
});

fs.writeFileSync(FILE, html, 'utf8');
console.log(`Converted ${count} table(s) to vi-grid.`);
