from counsel_deid.evals import rules


def hits(text):
    found, _ = rules.identifier_hits([["C", text]])
    return {h["rule"] for h in found}


def test_identifier_patterns():
    assert "R_SSN" in hits("my social is 512-44-8193")
    assert "R_PHONE" in hits("call (918) 555-0143")
    assert "R_SPOKEN_DIGITS" in hits("five one three, five five five, zero one nine eight")
    assert "R_EMAIL" in hits("maria.delacruz91@gmail.com")
    assert "R_AGE_90PLUS" in hits("I'm 93 now")
    assert "R_AGE_90PLUS" not in hits("I'm 34 now")
    assert "R_DATE_MONTH_DAY" in hits("since September 3rd")
    assert "R_TAG_LEFT" in hits("talk with Dr. <PERSON>")


def test_clean_text_has_no_identifier_hits():
    assert hits("Sometimes I wish I just wouldn't wake up. I don't have a plan.") == set()


def test_score_number_is_read_without_the_scale_digit():
    orig = [["T", "Your PHQ-9 today came out at 17."]]
    assert rules.clinical_checks(orig, [["T", "Your PHQ-9 score of 17 is moderately severe."]])["clinical_numbers_kept"] == {"PHQ-9 17": True}
    assert rules.clinical_checks(orig, [["T", "Your PHQ-9 is in the moderately severe range."]])["clinical_numbers_kept"] == {"PHQ-9 17": False}


def test_risk_terms_compared_against_original():
    orig = [["C", "No guns. I do have meds from work."]]
    kept = rules.clinical_checks(orig, [["C", "No firearms. I can get medication at work."]])["risk_terms_kept"]
    assert kept == {"firearm": True, "medication access": True}
