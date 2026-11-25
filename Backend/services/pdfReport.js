const PDFDocument = require("pdfkit");

function textBlock(doc, label, value) {
  doc.moveDown(0.25).font("Helvetica-Bold").text(label).font("Helvetica").text(String(value || "Not available"));
}

function streamReport(report, res) {
  const doc = new PDFDocument({ size: "A4", margin: 50, bufferPages: true });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="report-${report.id}.pdf"`);
  doc.pipe(res);

  doc.font("Helvetica-Bold").fontSize(20).text(report.title || "Interview Report");
  doc.moveDown(0.25).font("Helvetica").fontSize(10).text(`Generated: ${new Date().toISOString()}`);
  doc.moveDown();
  doc.font("Helvetica-Bold").fontSize(14).text("Scores");
  doc.font("Helvetica").text(`Overall: ${report.scores?.total || 0}/100`);
  doc.text(`Content: ${report.scores?.content || 0}/100`);
  doc.text(`Communication: ${report.scores?.communication || 0}/100`);

  doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Question Results");
  for (const [index, result] of (report.questionResults || []).entries()) {
    doc.moveDown(0.5).font("Helvetica-Bold").fontSize(11).text(`${index + 1}. ${result.question}`);
    doc.font("Helvetica").fontSize(10);
    doc.text(`Answer: ${result.answer || "Skipped"}`);
    doc.text(`Score: ${result.score}/100`);
    doc.text(`Feedback: ${result.feedback || "No feedback"}`);
    doc.text(`Sample answer: ${result.sampleAnswer || "Not available"}`);
  }

  doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Strengths");
  doc.font("Helvetica").text((report.strengths || []).join("\n") || "No strengths identified");
  doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Weaknesses");
  doc.font("Helvetica").text((report.weaknesses || []).join("\n") || "No weaknesses identified");
  doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Suggestions");
  doc.font("Helvetica").text((report.suggestions || []).join("\n") || "No suggestions available");
  doc.moveDown().font("Helvetica-Bold").fontSize(14).text("Communication Analysis");
  doc.font("Helvetica").text(report.communicationAnalysis?.summary || "No communication analysis available");

  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    doc.font("Helvetica").fontSize(9).text("Scored with rule-based-v1 (no AI used)", 50, 780, { align: "center", width: 495 });
  }
  doc.end();
}

module.exports = { streamReport };
