import { escapeHtml } from "../utils/dom.js";

export function table(headers,rows,{className=""}={}){
  return `<div class="table-wrap ${className}"><table><thead><tr>${headers.map(header=>`<th>${escapeHtml(header.label)}</th>`).join("")}</tr></thead><tbody>${rows.length?rows.map(row=>`<tr>${headers.map(header=>{const value=typeof header.value==="function"?header.value(row):row[header.value];return `<td>${header.html?value:escapeHtml(value)}</td>`}).join("")}</tr>`).join(""):`<tr><td colspan="${headers.length}" class="note">No rows found.</td></tr>`}</tbody></table></div>`;
}
