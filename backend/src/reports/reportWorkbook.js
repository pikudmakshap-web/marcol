'use strict';
const { deflateRawSync } = require('node:zlib');
// A bounded, dependency-free OOXML export. Text is always inlineStr, never a formula.
const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
const xml = value => String(value ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g,'').slice(0,32760).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
const decl = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const types = { sale:'רכישה',return:'החזרה',deposit:'הפקדה',withdrawal:'משיכה' };
function column(n) { let s=''; for(n++;n>0;n=Math.floor((n-1)/26)) s=String.fromCharCode(65+(n-1)%26)+s; return s; }
function excelDate(value) {
    if (!value || !Number.isFinite(new Date(value).getTime())) return null;
    const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{ timeZone:'Asia/Jerusalem', year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23' }).formatToParts(new Date(value)).map(p=>[p.type,p.value]));
    return (Date.UTC(+parts.year,+parts.month-1,+parts.day,+parts.hour,+parts.minute,+parts.second)-Date.UTC(1899,11,30))/86400000;
}
const dateText=value=>value?new Intl.DateTimeFormat('he-IL',{timeZone:'Asia/Jerusalem',dateStyle:'short',timeStyle:'short'}).format(new Date(value)):'';
function crc32(buffer) { let c=0xffffffff; for(const b of buffer){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0);}return (c^0xffffffff)>>>0; }
function zip(files) {
    const local=[],central=[];let offset=0;
    for(const [name,text] of files){
        const filename=Buffer.from(name), data=Buffer.from(text), body=deflateRawSync(data), crc=crc32(data);
        const h=Buffer.alloc(30);h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(0x800,6);h.writeUInt16LE(8,8);h.writeUInt16LE(33,12);h.writeUInt32LE(crc,14);h.writeUInt32LE(body.length,18);h.writeUInt32LE(data.length,22);h.writeUInt16LE(filename.length,26);
        local.push(h,filename,body);
        const c=Buffer.alloc(46);c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(0x800,8);c.writeUInt16LE(8,10);c.writeUInt16LE(33,14);c.writeUInt32LE(crc,16);c.writeUInt32LE(body.length,20);c.writeUInt32LE(data.length,24);c.writeUInt16LE(filename.length,28);c.writeUInt32LE(offset,42);
        central.push(c,filename);offset+=h.length+filename.length+body.length;
    }
    const directory=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(files.length,8);end.writeUInt16LE(files.length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
    return Buffer.concat([...local,directory,end]);
}
const styles=decl+`<styleSheet xmlns="${NS}"><numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00 &quot;₪&quot;;[Red](#,##0.00) &quot;₪&quot;;–"/><numFmt numFmtId="165" formatCode="dd/mm/yyyy hh:mm"/></numFmts><fonts count="3"><font><sz val="11"/><name val="Arial"/><color rgb="FF25352C"/></font><font><b/><sz val="18"/><name val="Arial"/><color rgb="FFFFFFFF"/></font><font><b/><sz val="11"/><name val="Arial"/><color rgb="FFFFFFFF"/></font></fonts><fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF526F52"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF0F5F0"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="11">${[[0,0,0],[1,2,0],[2,2,0],[0,3,0],[0,0,164],[0,3,164],[0,0,3],[0,3,3],[0,0,165],[0,3,165],[0,0,0]].map(([font,fill,num])=>`<xf numFmtId="${num}" fontId="${font}" fillId="${fill}" borderId="0" xfId="0" applyAlignment="1" applyNumberFormat="1" applyFont="1" applyFill="1"><alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/></xf>`).join('')}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
function cell(value,ref,style=0,numeric=false) {
    return numeric && Number.isFinite(value) ? `<c r="${ref}" s="${style}"><v>${value}</v></c>` : `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`;
}
function worksheet(title,columns,rows,metadata) {
    const end=column(columns.length-1),data=[];
    [title,...metadata,''].slice(0,6).forEach((text,index)=>data.push(`<row r="${index+1}" ht="${index===0?36:Math.min(180,Math.max(27,Math.ceil(String(text).length/Math.max(30,columns.reduce((n,c)=>n+(c.width||22),0)*0.9))*22))}" customHeight="1">${cell(text,`A${index+1}`,index===0?1:10)}</row>`));
    data.push(`<row r="7" ht="32" customHeight="1">${columns.map((c,i)=>cell(c.label,`${column(i)}7`,2)).join('')}</row>`);
    rows.forEach((row,i)=>data.push(`<row r="${i+8}" ht="${Math.min(120, Math.max(24, ...columns.map(c => { const v = typeof c.get === 'function' ? c.get(row) : row[c.key]; return c.kind === 'text' ? Math.ceil(String(v ?? '').length / Math.max(8, (c.width || 22) - 2)) * 16 + 8 : 24; })))}" customHeight="1">${columns.map((c,j)=>{
        let value=typeof c.get==='function'?c.get(row):row[c.key]; const band=i%2===1;
        const kind=c.getKind?c.getKind(row):c.kind;
        let style=band?3:0,numeric=kind==='money'||kind==='number'||kind==='date';
        if(kind==='date'){value=excelDate(value);style=band?9:8;} else if(kind==='money')style=band?5:4;else if(kind==='number')style=band?7:6;
        if(value===null||value===undefined){value='לא תועד';numeric=false;style=band?3:0;}
        return cell(value,`${column(j)}${i+8}`,style,numeric);
    }).join('')}</row>`));
    return decl+`<worksheet xmlns="${NS}"><dimension ref="A1:${end}${Math.max(7,rows.length+7)}"/><sheetViews><sheetView workbookViewId="0" rightToLeft="1" showGridLines="0"><pane ySplit="7" topLeftCell="A8" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A8" sqref="A8"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="24"/><cols>${columns.map((c,i)=>`<col min="${i+1}" max="${i+1}" width="${c.width||22}" customWidth="1"/>`).join('')}</cols><sheetData>${data.join('')}</sheetData>${rows.length?`<autoFilter ref="A7:${end}${rows.length+7}"/>`:''}<mergeCells count="5">${[1,2,3,4,5].map(n=>`<mergeCell ref="A${n}:${end}${n}"/>`).join('')}</mergeCells><printOptions horizontalCentered="1"/><pageMargins left="0.3" right="0.3" top="0.5" bottom="0.5" header="0.2" footer="0.2"/><pageSetup paperSize="9" orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`;
}
function workbook(report) {
    const f=report.filters;
    const labels={walletIds:'ארנקים',officerIds:'קצינים',cashierIds:'קופאים',actorIds:'מבצעי פעולה',productIds:'מוצרים',categories:'קטגוריות'};
    const optionKey={walletIds:'wallets',officerIds:'officers',cashierIds:'cashiers',actorIds:'actors',productIds:'products',categories:'categories'};
    const detail=Object.entries(labels).filter(([k])=>f[k]?.length).map(([k,v])=>`${v}: ${f[k].map(id=>report.options?.[optionKey[k]]?.find(x=>x.id===id)?.label||id).join(', ')}`).join(' | ');
    const metadata=[`${report.environment.name} | הופק: ${dateText(report.generatedAt)} | זמן ישראל`, report.mode==='inventory'?'מלאי נוכחי במועד ההפקה — לא מלאי היסטורי':`מ־${dateText(f.from)} עד ${dateText(f.to)} (לא כולל מועד הסיום)`, [detail,f.q?`חיפוש: ${f.q}`:'',`סטטוס: ${{completed:'הושלם',cancelled:'בוטל',all:'הכול'}[f.status]||f.status}`,f.types?.length?`סוגים: ${f.types.map(t=>types[t]).join(', ')}`:'',f.min!==null?`מינימום עסקה: ${f.min}`:'',f.max!==null?`מקסימום עסקה: ${f.max}`:''].filter(Boolean).join(' | '), report.lineFiltered?'הסיכומים לפי שורות המוצרים שסוננו; סכום העסקה המלא מוצג בנפרד':'הפקדות אינן מכירות; שמות מתעדכנים לפי הרשומות הקיימות, לא לפי שם היסטורי'];
    const col=(label,key,kind='text',width=22)=>({label,key,kind,width});
    const general=[col('מספר עסקה','transactionNumber','text',42),col('תאריך ושעה','createdAt','date'),col('סוג פעולה','transactionType'),col('סטטוס','status'),col('קצין שנרשם בעסקה','officerName'),col('מספר אישי','personalNumber'),col('מבצע הפעולה','actorName'),col('ארנק','walletName'),col('מספר ארנק','walletNumber'),col('סכום עסקה מלא','totalAmount','money'),col('סכום לפי סינון','matchedAmount','money'),col('יתרה לפני','walletBalanceBefore','money'),col('יתרה אחרי','walletBalanceAfter','money'),col('אישור מקבל','receiverEvidence','text',38),col('הערות','notes','text',40)];
    const linecols=[...general.slice(0,6),col('קופאי','cashierName'),col('ארנק','walletName'),col('מוצר','productName','text',32),col('קטגוריה','categoryName'),col('כמות','quantity','number'),col('מחיר יחידה','unitPrice','money'),col('סכום שורה','lineTotal','money')];
    const groupcols=[col('שם','name','text',32),col('מספר אישי','personalNumber'),col('מספר ארנק','walletNumber'),col('מספר עסקאות','transactions','number'),col('יחידות שנלקחו','quantityTaken','number'),col('יחידות שהוחזרו','quantityReturned','number'),col('רכישות','sales','money'),col('החזרות','returns','money'),col('מכירות נטו','net','money'),col('הפקדות','deposits','money'),col('משיכות','withdrawals','money'),col('מועד אחרון בטווח','lastAt','date')];
    const summaryLabels={transactions:'מספר תנועות',sales:'רכישות',returns:'החזרות',deposits:'הפקדות',withdrawals:'משיכות',netSales:'מכירות נטו',walletMovement:'שינוי ביתרות בתנועות המסוננות',products:'מספר מוצרים',units:'יחידות במלאי',knownInventoryValue:'שווי מלאי בעל עלות מתועדת',missingCosts:'מוצרים ללא עלות מתועדת'};
    const sheets=[{name:'סיכום',columns:[col('מדד','name','text',42),{...col('ערך','value','number',26),getKind:r=>['transactions','products','units','missingCosts'].includes(r.key)?'number':'money'}],rows:Object.entries(report.summary).map(([k,v])=>({key:k,name:summaryLabels[k]||k,value:v}))}];
    if(report.mode==='inventory') sheets.push({name:'מלאי נוכחי',columns:[col('מוצר','name','text',32),col('ברקוד','barcode'),col('SKU','sku'),col('קטגוריה','category'),col('ספק','supplierName'),col('מיקום','location'),col('כמות','quantity','number'),col('סף יחידות','minStockAlert','number'),col('עלות יחידה','costPerUnit','money'),col('שווי מלאי','inventoryValue','money'),col('מחיר מכירה','unitPrice','money')],rows:report.rows});
    else {
        const translate=r=>({...r,transactionType:types[r.transactionType]||r.transactionType,status:({completed:'הושלם',cancelled:'בוטל'})[r.status]||r.status});
        sheets.push({name:'עסקאות',columns:general,rows:report.rows.map(translate)},{name:'פירוט מוצרים',columns:linecols,rows:report.lines.map(translate)},...['officers','wallets','products'].map((k,i)=>({name:['לפי קצין ניהול','לפי ארנק','לפי מוצר'][i],columns:groupcols.filter(c => !['personalNumber','walletNumber'].includes(c.key) || (k === 'officers' && c.key === 'personalNumber') || (k === 'wallets' && c.key === 'walletNumber')),rows:report.groups[k]})));
    }
    const files=[['[Content_Types].xml',decl+`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],['_rels/.rels',decl+'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],['xl/workbook.xml',decl+`<workbook xmlns="${NS}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${sheets.map((s,i)=>`<sheet name="${xml(s.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],['xl/_rels/workbook.xml.rels',decl+`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="styles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],['xl/styles.xml',styles],...sheets.map((s,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(s.name,s.columns,s.rows,metadata)])];
    return zip(files);
}
module.exports={workbook,excelDate,crc32,xml};
