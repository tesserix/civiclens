import unittest

from administrative_reference import (
    india_records,
    nepal_records,
    nz_records,
    profile_links,
    validate_hierarchy,
)


class AdministrativeReferenceTests(unittest.TestCase):
    def test_india_preserves_official_codes_and_cross_district_coverage(self):
        states = [
            {
                "State Code": "1",
                "State Name (In English)": "Example State",
                "State or UT": "S",
            }
        ]
        districts = [
            {
                "State Code": "1",
                "District Code": str(i),
                "District Name(In English)": f"District {i}",
            }
            for i in [10, 11]
        ]
        bodies = [
            {
                "State Code": "1",
                "Local Body Code": "100",
                "Local Body Name (In English)": "Example Council",
                "Localbody Type Code": "5",
            }
        ]
        coverage = [
            {"Local Body Code": "100", "District Code": str(i)} for i in [10, 11, 11]
        ]
        records = india_records(states, districts, bodies, coverage)
        council = next(r for r in records if r["id"] == "in-ulb-100")
        self.assertEqual(council["details"]["parentId"], "in-state-1")
        self.assertEqual(
            council["details"]["districtIds"], ["in-district-10", "in-district-11"]
        )
        self.assertEqual(council["details"]["complaintApiStatus"], "unknown")
        self.assertTrue(all(r["verificationStatus"] == "reference" for r in records))
        validate_hierarchy(records)

    def test_nepal_does_not_count_protected_areas_as_municipalities(self):
        provinces = [{"adm1_pcode": "NP01", "adm1_name": "Koshi"}]
        districts = [
            {"adm2_pcode": "NP0101", "adm2_name": "Taplejung", "adm1_pcode": "NP01"}
        ]
        local = [
            {
                "adm3_pcode": "NP0101301",
                "adm3_name": "Phungling",
                "adm2_pcode": "NP0101",
                "adm1_pcode": "NP01",
            },
            {
                "adm3_pcode": "NP0101595",
                "adm3_name": "Protected Area",
                "adm2_pcode": "NP0101",
                "adm1_pcode": "NP01",
            },
        ]
        records = nepal_records(provinces, districts, local)
        self.assertEqual(
            sum(r["details"]["adminLevel"] == "municipality" for r in records), 1
        )
        self.assertEqual(
            sum(r["details"]["adminLevel"] == "protected_area" for r in records), 1
        )
        validate_hierarchy(records)

    def test_nz_filters_non_council_organisations_and_keeps_all_distinct_councils(self):
        html = '<a href="/organisations/auckland-council/">Auckland Council</a><a href="/organisations/auckland-council/">Auckland Council</a><a href="/organisations/environment-southland/">Environment Southland</a><a href="/organisations/accounting/">External Reporting Board</a><a href="https://malicious.invalid/fake">Fake District Council</a>'
        records = nz_records(html)
        self.assertEqual(len(records), 3)
        self.assertTrue(all(r["countryCode"] == "NZ" for r in records))
        validate_hierarchy(records)

    def test_duplicate_or_cross_country_or_cyclic_hierarchy_is_rejected(self):
        records = nz_records(
            '<a href="/organisations/auckland-council/">Auckland Council</a>'
        )
        with self.assertRaises(ValueError):
            validate_hierarchy(records + [records[-1]])
        records[-1]["details"]["parentId"] = "unknown-country"
        with self.assertRaises(ValueError):
            validate_hierarchy(records)
        records[-1]["details"]["parentId"] = records[-1]["id"]
        with self.assertRaises(ValueError):
            validate_hierarchy(records)

    def test_nz_contact_links_are_taken_from_official_profile_fields(self):
        html = '<a href="https://www.aucklandcouncil.govt.nz/" data-type="website">Website</a><a href="https://www.aucklandcouncil.govt.nz/report-problem/Pages/default.aspx" data-type="contactpage">More contact details</a><a href="https://unrelated.invalid/">Other</a>'
        self.assertEqual(
            profile_links(html),
            {
                "website": "https://www.aucklandcouncil.govt.nz/",
                "contactpage": "https://www.aucklandcouncil.govt.nz/report-problem/Pages/default.aspx",
            },
        )
        with self.assertRaises(ValueError):
            profile_links(
                '<a data-type="website" href="https://user:password@localhost/">Website</a>'
            )

    def test_a_council_cannot_be_the_parent_of_another_council(self):
        records = nz_records(
            '<a href="/organisations/auckland-council/">Auckland Council</a><a href="/organisations/dunedin-city-council/">Dunedin City Council</a>'
        )
        records[1]["details"]["parentId"] = records[2]["id"]
        with self.assertRaises(ValueError):
            validate_hierarchy(records)


if __name__ == "__main__":
    unittest.main()
