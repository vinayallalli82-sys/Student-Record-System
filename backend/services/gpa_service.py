"""FR-004: Semester GPA calculation service."""

from decimal import Decimal, ROUND_HALF_UP


# Grading scale: (minimum percentage, letter grade, grade point).
GRADE_SCALE = [
    (Decimal("90"), "S", Decimal("10")),
    (Decimal("80"), "A", Decimal("9")),
    (Decimal("70"), "B", Decimal("8")),
    (Decimal("60"), "C", Decimal("7")),
    (Decimal("50"), "D", Decimal("6")),
    (Decimal("40"), "E", Decimal("5")),
    (Decimal("0"), "F", Decimal("0")),
]


def marks_to_grade(marks, max_marks=100):
    """Return the letter grade and grade point for the given marks."""
    marks = Decimal(str(marks))
    max_marks = Decimal(str(max_marks))
    if max_marks <= 0:
        raise ValueError("max_marks must be greater than 0")
    if marks < 0 or marks > max_marks:
        raise ValueError(f"marks must be between 0 and {max_marks}")

    percentage = marks / max_marks * Decimal("100")
    for minimum_percentage, letter, grade_point in GRADE_SCALE:
        if percentage >= minimum_percentage:
            return letter, grade_point
    return "F", Decimal("0")


def calculate_semester_gpa(subjects):
    """Calculate credit-weighted semester GPA and subject-wise results."""
    if not subjects:
        raise ValueError("No subjects supplied")

    weighted_points = Decimal("0")
    total_credits = Decimal("0")
    results = []

    for subject in subjects:
        code = subject.get("code") or subject.get("subject_code")
        subject_name = subject.get("subject_name")
        subject_id = subject.get("subject_id")

        try:
            credits = Decimal(str(subject["credits"]))
        except (KeyError, ValueError, TypeError, ArithmeticError):
            raise ValueError(f"Invalid credits for subject {code}") from None
        if not credits.is_finite() or credits <= 0:
            raise ValueError(f"Invalid credits for {code}")

        try:
            marks = Decimal(str(subject["marks"]))
            max_marks = Decimal(str(subject.get("max_marks", 100)))
        except (KeyError, ValueError, TypeError, ArithmeticError):
            raise ValueError(f"Invalid marks for subject {code}") from None
        if not marks.is_finite() or not max_marks.is_finite():
            raise ValueError(f"Invalid marks for subject {code}")

        letter, grade_point = marks_to_grade(marks, max_marks)
        weighted_points += grade_point * credits
        total_credits += credits
        results.append({
            "subject_id": subject_id,
            "code": code,
            "subject_code": code,
            "subject_name": subject_name,
            "grade": letter,
            "grade_point": float(grade_point),
            "credits": float(credits),
        })

    if total_credits <= 0:
        raise ValueError("Total credits must be greater than zero")
    gpa = (weighted_points / total_credits).quantize(
        Decimal("0.01"), rounding=ROUND_HALF_UP
    )
    return {
        "gpa": float(gpa),
        "total_credits": float(total_credits),
        "subjects": results,
    }
