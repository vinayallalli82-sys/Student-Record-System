"""FR-004: semester GPA = sum(grade_point * credits) / sum(credits)."""
from decimal import Decimal, ROUND_HALF_UP

# EDIT to match your institution's grading rules: (min percentage, letter, grade point)
GRADE_SCALE = [
    (Decimal("90"), "S", Decimal("10")),
    (Decimal("80"), "A", Decimal("9")),
    (Decimal("70"), "B", Decimal("8")),
    (Decimal("60"), "C", Decimal("7")),
    (Decimal("50"), "D", Decimal("6")),
    (Decimal("40"), "E", Decimal("5")),
    (Decimal("0"),  "F", Decimal("0")),
]


def marks_to_grade(marks, max_marks=100):
    """Return (letter, grade_point) for the given marks."""
    marks, max_marks = Decimal(str(marks)), Decimal(str(max_marks))
    if max_marks <= 0:
        raise ValueError("max_marks must be greater than 0")
    if marks < 0 or marks > max_marks:
        raise ValueError(f"marks must be between 0 and {max_marks}")
    percent = marks / max_marks * 100
    for min_pct, letter, point in GRADE_SCALE:
        if percent >= min_pct:
            return letter, point


def calculate_semester_gpa(subjects):
    """
    subjects: list of dicts, one per subject, e.g.
        [{"code": "MA101", "marks": 92, "max_marks": 100, "credits": 4}, ...]
    Credits come from the subjects table (FR-008).
    """
    if not subjects:
        raise ValueError("No subjects supplied")

    weighted, total_credits, results = Decimal("0"), Decimal("0"), []
    for s in subjects:
        credits = Decimal(str(s["credits"]))
        if credits <= 0:
            raise ValueError(f"Invalid credits for {s.get('code')}")
        letter, point = marks_to_grade(s["marks"], s.get("max_marks", 100))
        weighted += point * credits
        total_credits += credits
        results.append({"code": s.get("code"), "grade": letter,
                        "grade_point": float(point), "credits": float(credits)})

    gpa = (weighted / total_credits).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return {"gpa": float(gpa), "total_credits": float(total_credits), "subjects": results}
