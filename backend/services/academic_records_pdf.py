
"""PDF generation service for student academic records."""

from io import BytesIO

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)


def generate_academic_records_pdf(data):
    """Generate a downloadable PDF from academic-record data."""

    buffer = BytesIO()

    document = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="Student Academic Records",
        author="Student Record System",
    )

    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=styles["Title"],
        alignment=TA_CENTER,
        fontSize=18,
        spaceAfter=12,
    )

    heading_style = ParagraphStyle(
        "SectionHeading",
        parent=styles["Heading2"],
        fontSize=12,
        spaceBefore=12,
        spaceAfter=6,
    )

    story = []

    story.append(Paragraph("Student Academic Records", title_style))
    story.append(Spacer(1, 8))

    story.append(Paragraph(
        f"<b>Student ID:</b> {data['student_id']}",
        styles["Normal"],
    ))
    story.append(Paragraph(
        f"<b>Semester:</b> {data['semester']}",
        styles["Normal"],
    ))
    story.append(Paragraph(
        f"<b>Academic Year:</b> {data['academic_year']}",
        styles["Normal"],
    ))
    story.append(Spacer(1, 12))

    subjects = data.get("subjects", [])

    if not subjects:
        story.append(Paragraph(
            "No academic records are available for this semester.",
            styles["Normal"],
        ))

    for subject in subjects:
        story.append(Paragraph(
            f"{subject['subject_code']} - {subject['subject_name']}",
            heading_style,
        ))

        story.append(Paragraph(
            f"<b>Credits:</b> {subject['credits']}",
            styles["Normal"],
        ))

        assessment_rows = [[
            "Assessment",
            "Marks Obtained",
            "Maximum Marks",
            "Percentage",
            "Grade",
        ]]

        for assessment in subject.get("assessments", []):
            assessment_rows.append([
                assessment["assessment_name"],
                str(assessment["marks_obtained"]),
                str(assessment["max_marks"]),
                f"{assessment['percentage']}%",
                assessment["grade"],
            ])

        if len(assessment_rows) > 1:
            assessment_table = Table(
                assessment_rows,
                repeatRows=1,
                colWidths=[45 * mm, 28 * mm, 28 * mm, 25 * mm, 20 * mm],
            )
            assessment_table.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#24476B")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("PADDING", (0, 0), (-1, -1), 5),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]))
            story.append(assessment_table)
        else:
            story.append(Paragraph(
                "No assessment marks available.",
                styles["Normal"],
            ))

        story.append(Spacer(1, 6))
        story.append(Paragraph(
            f"<b>Total Marks:</b> "
            f"{subject['total_marks_obtained']} / "
            f"{subject['total_max_marks']}",
            styles["Normal"],
        ))

        attendance = subject.get("attendance", {})

        story.append(Paragraph(
            f"<b>Attendance:</b> "
            f"{attendance.get('classes_attended', 0)} / "
            f"{attendance.get('total_classes', 0)} classes "
            f"({attendance.get('percentage', 0)}%)",
            styles["Normal"],
        ))

        story.append(Spacer(1, 10))

    document.build(story)

    buffer.seek(0)
    return buffer
