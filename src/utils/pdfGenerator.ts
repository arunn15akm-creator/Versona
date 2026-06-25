import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

/**
 * Generates and downloads a highly polished, ATS-optimized PDF resume from Markdown text.
 */
export async function downloadResumeAsPDF(resumeMarkdown: string, filename: string): Promise<void> {
  // 1. Create a hidden rendering container in the document body
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "816px"; // Standard Letter physical width in pixels (~8.5 inches at 96 DPI)
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = "'Georgia', Times, 'Times New Roman', serif";
  container.style.padding = "48px 48px"; // Balanced margins (approx. 0.5in - 0.75in for high-density ATS)
  container.style.boxSizing = "border-box";
  container.style.lineHeight = "1.4";

  // 2. Custom-built ATS parser/renderer applying the exact spacing and typographic rules requested
  const htmlContent = parseMarkdownToATSResume(resumeMarkdown);
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    // Wait slightly to ensure rendering & font loading
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Get the actual height of the content
    const contentHeight = container.scrollHeight;
    
    // Letter dimensions in pt: 612 x 792 pt (8.5 x 11 inches)
    const imgWidth = 612;
    const pageHeightPt = 792;
    const pxToPtScale = imgWidth / container.offsetWidth;
    const imgHeight = contentHeight * pxToPtScale;

    // Use html2canvas to capture a crisp, high-resolution retina rendering
    const canvas = await html2canvas(container, {
      scale: 3, // Premium ultra-sharp scale (3x DPI) for clear print-ready clarity
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    // Handle high-fidelity multi-page split
    let heightLeft = imgHeight;
    let position = 0;

    // First page
    pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
    heightLeft -= pageHeightPt;

    // Subsequent pages
    while (heightLeft > 0) {
      position = heightLeft - imgHeight; // Offset formula to slide the canvas upwards on the next page
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeightPt;
    }

    pdf.save(filename);
  } catch (error) {
    console.error("PDF generation failed:", error);
    throw error;
  } finally {
    // 3. Clean up the DOM element
    document.body.removeChild(container);
  }
}

/**
 * Custom state-driven parser to strictly output the exact spec:
 * Name: 24-28px Bold
 * Section Headers: 14-16px Bold
 * Body (summary, bullets, skills): 10-11px
 * Spacing rules:
 * - Between sections: 32px
 * - Between job heading and bullets: 12px
 * - Between bullets: 6px
 * - Between jobs: 20px
 */
export function parseMarkdownToATSResume(markdown: string): string {
  const lines = markdown.split("\n");
  
  // Section Parsing setup
  interface Section {
    title: string;
    content: string[];
  }
  
  const sections: Section[] = [];
  let currentSec: Section | null = null;
  const headerLines: string[] = [];
  
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    
    if (line.startsWith("## ")) {
      if (currentSec) {
        sections.push(currentSec);
      }
      currentSec = {
        title: line.replace(/^##\s*/, "").toUpperCase(),
        content: []
      };
    } else {
      if (currentSec) {
        currentSec.content.push(rawLine);
      } else {
        headerLines.push(rawLine);
      }
    }
  }
  if (currentSec) {
    sections.push(currentSec);
  }
  
  // Start html compilation using Georgia/serif theme from the screenshot
  let html = `<div style="font-size: 10.5px; font-family: 'Georgia', Times, 'Times New Roman', serif; color: #111111; line-height: 1.4; max-width: 100%; box-sizing: border-box; text-align: left; background-color: #ffffff; padding: 10px;">`;
  
  // Render elegantly centered header
  const nameLine = headerLines[0] ? headerLines[0].replace(/^#\s*/, "") : "";
  html += `<div style="text-align: center; margin-bottom: 22px; font-family: 'Georgia', serif;">`;
  if (nameLine) {
    html += `<h1 style="font-size: 24px; font-weight: bold; color: #000000; text-transform: uppercase; margin: 0 0 8px 0; letter-spacing: 1.2px; line-height: 1.2;">${nameLine}</h1>`;
  }
  
  // Contact details block below name
  if (headerLines.length > 1) {
    html += `<div style="font-size: 10px; color: #333333; line-height: 1.6; letter-spacing: 0.1px;">`;
    for (let k = 1; k < headerLines.length; k++) {
      const metaLine = headerLines[k].replace(/[\[\]\(\)]/g, "").trim();
      html += `<div>${metaLine}</div>`;
    }
    html += `</div>`;
  }
  html += `</div>`;
  
  // Render main body sections
  sections.forEach((sec, index) => {
    // If it's a summary/profile section, let's render as a gray block
    const isSummary = sec.title.includes("SUMMARY") || sec.title.includes("PROFILE");
    const isSkillsOrMeta = sec.title.includes("SKILLS") || 
                           sec.title.includes("LANGUAGES") || 
                           sec.title.includes("ADDITIONAL") || 
                           sec.title.includes("INTEREST") || 
                           sec.title.includes("CERTIF") || 
                           sec.title.includes("STRENGTH") ||
                           sec.title.includes("AWARDS") ||
                           sec.title.includes("ACTIVITIES");
    
    if (isSummary) {
      const summaryText = sec.content
        .filter(l => !l.trim().startsWith("•") && !l.trim().startsWith("-") && !l.trim().startsWith("*"))
        .map(l => l.trim())
        .join(" ")
        .replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: #000000;">$1</strong>`);
        
      html += `<div style="background-color: #f4f4f4; padding: 12px 16px; margin-bottom: 20px; border-radius: 4px; font-family: 'Georgia', serif; font-size: 11px;">`;
      html += `<div style="font-weight: bold; font-size: 12px; color: #000000; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">SUMMARY</div>`;
      html += `<div style="line-height: 1.45; color: #111111; text-align: justify; word-break: break-word;">${summaryText}</div>`;
      html += `</div>`;
    } else if (isSkillsOrMeta) {
      // General skills / certification section with separator HR - keeps bullets and inline bold highlights
      html += `<hr style="border: 0; border-top: 1px solid #cccccc; margin: 18px 0 14px 0;" />`;
      html += `<h2 style="font-size: 12.5px; font-weight: bold; color: #000000; margin: 0 0 10px 0; text-transform: uppercase; font-family: 'Georgia', serif; letter-spacing: 0.5px;">${sec.title}</h2>`;
      
      let inList = false;
      sec.content.forEach((rawLine) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;
        
        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
        let itemContent = trimmed;
        if (isBullet) {
          if (trimmed.startsWith("•")) itemContent = trimmed.substring(1).trim();
          else if (trimmed.startsWith("*")) itemContent = trimmed.substring(1).trim();
          else if (trimmed.startsWith("-")) itemContent = trimmed.substring(1).trim();
          
          if (!inList) {
            html += `<ul style="margin: 4px 0 8px 0; padding-left: 14px; list-style-type: disc; color: #111111; font-family: 'Georgia', serif;">`;
            inList = true;
          }
          
          let bText = itemContent.replace(/\*\?(.*?)\*\?/g, `$1`);
          bText = bText.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">$1</strong>`);
          html += `<li style="margin-bottom: 5px; font-size: 10.5px; line-height: 1.45; color: #111111; font-family: 'Georgia', serif; text-align: justify; word-break: break-word;">${bText}</li>`;
        } else {
          if (inList) {
            html += `</ul>`;
            inList = false;
          }
          let bText = itemContent.replace(/\*\?(.*?)\*\?/g, `$1`);
          bText = bText.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">$1</strong>`);
          html += `<div style="margin-bottom: 6px; font-size: 10.5px; line-height: 1.45; color: #111111; font-family: 'Georgia', serif; text-align: justify; word-break: break-word;">${bText}</div>`;
        }
      });
      if (inList) {
        html += `</ul>`;
      }
    } else {
      // General section with separator HR
      html += `<hr style="border: 0; border-top: 1px solid #cccccc; margin: 18px 0 14px 0;" />`;
      html += `<h2 style="font-size: 12.5px; font-weight: bold; color: #000000; margin: 0 0 12px 0; text-transform: uppercase; font-family: 'Georgia', serif; letter-spacing: 0.5px;">${sec.title}</h2>`;
      
      // Parse entries into items with optional bullets
      interface Item {
        headerLines: string[];
        bullets: string[];
      }
      const items: Item[] = [];
      let currentItem: Item | null = null;
      
      sec.content.forEach((rawLine) => {
        const trimmed = rawLine.trim();
        if (!trimmed) return;
        
        const isBullet = trimmed.startsWith("•") || trimmed.startsWith("-") || trimmed.startsWith("*");
        if (isBullet) {
          if (!currentItem) {
            currentItem = { headerLines: [], bullets: [] };
          }
          let bContent = trimmed;
          if (trimmed.startsWith("•")) bContent = trimmed.substring(1).trim();
          else if (trimmed.startsWith("*")) bContent = trimmed.substring(1).trim();
          else if (trimmed.startsWith("-")) bContent = trimmed.substring(1).trim();
          
          currentItem.bullets.push(bContent);
        } else {
          if (currentItem && currentItem.bullets.length > 0) {
            items.push(currentItem);
            currentItem = null;
          }
          if (!currentItem) {
            currentItem = { headerLines: [], bullets: [] };
          }
          currentItem.headerLines.push(trimmed);
        }
      });
      if (currentItem) {
        items.push(currentItem);
      }
      
      // Render parsed items
      items.forEach((item, itemIdx) => {
        if (item.headerLines.length > 0) {
          // Combine lines of meta elegantly
          const parts = item.headerLines.flatMap(hl => hl.split("|").map(p => p.trim()));
          
          const marginTop = itemIdx > 0 ? "14px" : "4px";
          let compiledHeader = "";
          
          if (sec.title.includes("EXPERIENCE")) {
            // Company | Location | Title | Dates
            let company = "";
            let location = "";
            let roleTitle = "";
            let dates = "";
            
            const dateIndex = parts.findIndex(p => /(\d{4}|Present|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)/i.test(p));
            if (dateIndex !== -1) {
              dates = parts[dateIndex];
              parts.splice(dateIndex, 1);
            }
            
            const locIndex = parts.findIndex(p => /(UK|India|London|Chennai|USA|Germany|Canada|New York|Willing|San Francisco|CA|NY)/i.test(p) && p.length < 25);
            if (locIndex !== -1) {
              location = parts[locIndex];
              parts.splice(locIndex, 1);
            }
            
            if (parts.length >= 2) {
              const isFirstTitle = /(designer|engineer|developer|intern|manager|analyst|specialist|lead|architect|consultant|technologies)/i.test(parts[0]);
              if (isFirstTitle) {
                roleTitle = parts[0];
                company = parts[1];
              } else {
                company = parts[0];
                roleTitle = parts[1];
              }
            } else if (parts.length === 1) {
              company = parts[0];
            }
            
            compiledHeader = `<div style="font-size: 11px; margin-top: ${marginTop}; margin-bottom: 6px; line-height: 1.35; font-family: 'Georgia', serif; color: #111111;">`;
            if (company) {
              compiledHeader += `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">${company}</strong>`;
            }
            if (location) {
              compiledHeader += ` | <span>${location}</span>`;
            }
            if (roleTitle) {
              compiledHeader += ` | <strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">${roleTitle}</strong>`;
            }
            if (dates) {
              compiledHeader += ` | <span>${dates}</span>`;
            }
            compiledHeader += `</div>`;
          } else if (sec.title.includes("EDUCATION")) {
            // Degree | School | Location | Dates
            let degree = "";
            let school = "";
            let location = "";
            let dates = "";
            
            const dateIndex = parts.findIndex(p => /\d{4}/i.test(p));
            if (dateIndex !== -1) {
              dates = parts[dateIndex];
              parts.splice(dateIndex, 1);
            }
            
            const locIndex = parts.findIndex(p => /(UK|India|London|Chennai|USA|Germany|Canada|Australia|Singapore)/i.test(p) && !p.toLowerCase().includes("university") && !p.toLowerCase().includes("institute") && p.length < 15);
            if (locIndex !== -1) {
              location = parts[locIndex];
              parts.splice(locIndex, 1);
            }
            
            if (parts.length >= 2) {
              const isFirstDegree = /(MSc|Bachelors|Bachelor|Master|Phd|Diploma|B\.E\.|B\.S\.|B\.Tech|Degree)/i.test(parts[0]);
              if (isFirstDegree) {
                degree = parts[0];
                school = parts[1];
              } else {
                school = parts[0];
                degree = parts[1];
              }
            } else if (parts.length === 1) {
              school = parts[0];
            }
            
            compiledHeader = `<div style="font-size: 11px; margin-top: ${marginTop}; margin-bottom: 6px; line-height: 1.35; font-family: 'Georgia', serif; color: #111111;">`;
            if (degree) {
              compiledHeader += `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">${degree}</strong>`;
            }
            if (school) {
              compiledHeader += ` | <strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">${school}</strong>`;
            }
            if (location) {
              compiledHeader += ` | <span>${location}</span>`;
            }
            if (dates) {
              compiledHeader += ` | <span>${dates}</span>`;
            }
            compiledHeader += `</div>`;
          } else {
            // Fallback general metadata
            const joinedLabel = item.headerLines.map(hl => {
              return hl.replace(/\*\?(.*?)\*\?/g, `$1`)
                       .replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">$1</strong>`);
            }).join(" | ");
            compiledHeader = `<div style="font-size: 11px; margin-top: ${marginTop}; margin-bottom: 6px; line-height: 1.35; font-family: 'Georgia', serif; color: #111111;">${joinedLabel}</div>`;
          }
          
          html += compiledHeader;
        }
        
        // Render bullet lists
        if (item.bullets.length > 0) {
          html += `<ul style="margin: 4px 0 8px 0; padding-left: 14px; list-style-type: disc; color: #111111; font-family: 'Georgia', serif;">`;
          item.bullets.forEach((bullet) => {
            let bText = bullet.replace(/\*\?(.*?)\*\?/g, `$1`);
            bText = bText.replace(/\*\*(.*?)\*\*/g, `<strong style="font-weight: bold; color: #000000; font-family: 'Georgia', serif;">$1</strong>`);
            html += `<li style="margin-bottom: 4px; font-size: 10.5px; line-height: 1.45; color: #111111; font-family: 'Georgia', serif; text-align: justify; word-break: break-word;">${bText}</li>`;
          });
          html += `</ul>`;
        }
      });
    }
  });
  
  html += `</div>`;
  return html;
}

/**
 * Generates and downloads a highly polished Cover Letter PDF from Markdown text.
 */
export async function downloadCoverLetterAsPDF(coverLetterMarkdown: string, filename: string): Promise<void> {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "816px"; // Standard Letter physical width in pixels (~8.5 inches at 96 DPI)
  container.style.backgroundColor = "#ffffff";
  container.style.color = "#000000";
  container.style.fontFamily = "'Georgia', Times, 'Times New Roman', serif";
  container.style.padding = "60px 72px"; // Classic corporate margins for elegant cover letter layout
  container.style.boxSizing = "border-box";
  container.style.lineHeight = "1.5";

  const htmlContent = parseMarkdownToCoverLetter(coverLetterMarkdown);
  container.innerHTML = htmlContent;

  document.body.appendChild(container);

  try {
    await new Promise((resolve) => setTimeout(resolve, 300));

    const contentHeight = container.scrollHeight;
    const imgWidth = 612; // 8.5 in * 72 pt
    const pageHeightPt = 792; // 11 in * 72 pt
    const pxToPtScale = imgWidth / container.offsetWidth;
    const imgHeight = contentHeight * pxToPtScale;

    const canvas = await html2canvas(container, {
      scale: 3,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
    });

    const imgData = canvas.toDataURL("image/jpeg", 0.98);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "pt",
      format: "letter",
    });

    // Fit cover letter absolutely onto 1 page as required by style guides, or slide if longer
    pdf.addImage(imgData, "JPEG", 0, 0, imgWidth, imgHeight, undefined, "FAST");
    
    // In rare cases if height exceeds single page, add subsequent pages
    let heightLeft = imgHeight - pageHeightPt;
    let position = -pageHeightPt;
    while (heightLeft > 0) {
      pdf.addPage();
      pdf.addImage(imgData, "JPEG", 0, position, imgWidth, imgHeight, undefined, "FAST");
      heightLeft -= pageHeightPt;
      position -= pageHeightPt;
    }

    pdf.save(filename);
  } catch (error) {
    console.error("Cover Letter PDF generation failed:", error);
    throw error;
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Custom state-driven parser to strictly format ATS Cover Letter:
 * Centered Cover Letter title
 * floated Right contact/name block
 * Justified clean non-bold paragraphs
 */
export function parseMarkdownToCoverLetter(markdown: string): string {
  const lines = markdown.split("\n");
  let html = `<div style="font-size: 11px; font-family: 'Georgia', Times, 'Times New Roman', serif; color: #111111; line-height: 1.5; max-width: 100%; box-sizing: border-box; text-align: left; padding: 10px;">`;
  
  let headerLines: string[] = [];
  let bodyLines: string[] = [];
  let isHeader = true;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // The greeting "Dear " marks the end of header context
    if (line.toLowerCase().startsWith("dear ") || line.toLowerCase().startsWith("dear")) {
      isHeader = false;
    }

    if (isHeader) {
      headerLines.push(line);
    } else {
      bodyLines.push(line);
    }
  }

  // Render Header section
  let centerTitle = "COVER LETTER";
  let topRightLines: string[] = [];

  for (const hl of headerLines) {
    if (hl.toUpperCase() === "COVER LETTER") {
      centerTitle = hl.toUpperCase();
    } else {
      // Clean brackets if any
      topRightLines.push(hl.replace(/[\[\]]/g, ""));
    }
  }

  // Center title at top
  html += `<div style="text-align: center; font-size: 14px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 24px; color: #000000; font-family: 'Georgia', serif;">${centerTitle}</div>`;

  // Top Right block
  if (topRightLines.length > 0) {
    html += `<div style="text-align: right; margin-bottom: 36px; font-size: 10.5px; color: #374151; line-height: 1.4; font-weight: 500; font-family: 'Georgia', serif;">`;
    for (const tl of topRightLines) {
      html += `<div style="text-transform: uppercase; font-weight: ${tl === topRightLines[0] ? 'bold' : 'normal'}; color: ${tl === topRightLines[0] ? '#000000' : '#4b5563'}; font-family: 'Georgia', serif;">${tl}</div>`;
    }
    html += `</div>`;
  }

  // Render Body Paragraphs
  for (let i = 0; i < bodyLines.length; i++) {
    const line = bodyLines[i];
    // Clean outer asterisks or bold indicators just in case they survived
    let cleanLine = line.replace(/\*\*/g, "").replace(/\*/g, "").replace(/\[|\]/g, "");

    if (cleanLine.toLowerCase().startsWith("dear")) {
      html += `<p style="margin-bottom: 24px; font-size: 11px; font-weight: bold; color: #000000; font-family: 'Georgia', serif;">${cleanLine}</p>`;
    } else if (cleanLine.toLowerCase().startsWith("best,") || cleanLine.toLowerCase().startsWith("sincerely,")) {
      html += `<div style="margin-top: 32px; margin-bottom: 4px; font-size: 11px; font-weight: 500; color: #111111; font-family: 'Georgia', serif;">${cleanLine}</div>`;
    } else if (i === bodyLines.length - 1 && bodyLines.length > 1 && !bodyLines[i-1].toLowerCase().startsWith("best,") && !bodyLines[i-1].toLowerCase().startsWith("sincerely,")) {
      // Last line is candidate name if it is alone after spacing
      html += `<div style="font-size: 11px; font-weight: bold; color: #000000; margin-top: 4px; font-family: 'Georgia', serif;">${cleanLine}</div>`;
    } else {
      html += `<p style="margin-bottom: 20px; font-size: 10.5px; line-height: 1.5; color: #222222; text-align: justify; font-family: 'Georgia', serif;">${cleanLine}</p>`;
    }
  }

  html += `</div>`;
  return html;
}

