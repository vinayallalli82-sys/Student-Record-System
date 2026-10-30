"""FR-009: Calculate cumulative GPA across all semesters."""

from decimal import Decimal, ROUND_HALF_UP

from backend.services.gpa_service import marks_to_grade


def calculate_cgpa(subjects):
    """Calculate credit-weighted CGPA from graded subjects.

    Each subject must contain marks, max_marks, and credits.
    Marks from a subject's assessments should be aggregated before
    passing the subject to this function.
    """
    if not subjects:
        raise ValueError("No marks available to calculate CGPA")

    weighted_points = Decimal("0")
    total_credits = Decimal("0")

    for subject in subjects:
        credits = Decimal(str(subject["credits"]))

        if not credits.is_finite() or credits <= 0:
            raise ValueError("Subject credits must be greater than zero")

        _, grade_point = marks_to_grade(
            subject["marks"],
            subject.get("max_marks", 100),
        )

        weighted_points += grade_point * credits
        total_credits += credits

    cgpa = (weighted_points / total_credits).quantize(
        Decimal("0.01"),
        rounding=ROUND_HALF_UP,
    )

    return {
        "cgpa": float(cgpa),
        "total_credits": float(total_credits),
    }
