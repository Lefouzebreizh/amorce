import argparse
from copy import deepcopy
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

import evaluation_fr as bench


class EvaluationFrTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.corpus = bench.validate_corpus(bench.read_json(bench.DEFAULT_CORPUS))

    def run_fixture(self, records):
        return {"schema_version": 1, "run_kind": "fixture_demo", "corpus_sha256": bench.digest(self.corpus), "records": records, "metadata": {"label": "FIXTURE"}}

    def test_corpus_has_five_categories_and_unique_prompts(self):
        self.assertEqual(len(self.corpus["cases"]), 15)
        self.assertEqual(set(c["category"] for c in self.corpus["cases"]), bench.CATEGORIES)
        self.assertEqual(len(set(c["question"] for c in self.corpus["cases"])), 15)

    def test_normalization_handles_unicode_but_preserves_actual_language_errors(self):
        self.assertEqual(bench.normalize(" L’atelier\u00a0ouvre\nà 9 h 30. "), "L'atelier ouvre à 9 h 30.")
        self.assertEqual(bench.normalize("e\u0301"), "é")
        self.assertNotEqual(bench.normalize("chevals"), bench.normalize("chevaux"))
        self.assertNotEqual(bench.normalize("a"), bench.normalize("à"))
        self.assertNotEqual(bench.normalize("bleu."), bench.normalize("bleu"))

    def test_expected_fixtures_test_scorer_without_qualifying_any_model(self):
        records = [{"id": c["id"], "status": "ok", "response": c["expected"]} for c in self.corpus["cases"]]
        report = bench.score(self.corpus, self.run_fixture(records))
        self.assertEqual(report["pass_fraction_all_cases"], "15/15")
        self.assertFalse(report["production_model_ready"])
        self.assertEqual(report["run_kind"], "fixture_demo")
        self.assertTrue(all(c["duration_ms"] is None for c in report["cases"]))

    def test_demo_distinguishes_missing_execution_failure_invalid_and_wrong(self):
        report = bench.score(self.corpus, bench.demo_run(self.corpus))
        self.assertEqual(report["statuses"], {"pass": 3, "fail": 1, "missing": 8, "execution_error": 1, "invalid_response": 1, "invalid_record": 1})
        self.assertIn("fixture_demo", bench.markdown_report(report))

    def test_false_quote_and_source_are_not_accepted(self):
        case = self.corpus["cases"][3]
        response = deepcopy(case["expected"])
        response["citations"] = [{"source_id": "S99", "quote": "L’atelier ouvre à 9 h 30."}]
        report = bench.score_case(case, {"id": case["id"], "status": "ok", "response": response})
        self.assertEqual(report["status"], "fail")
        self.assertFalse(report["checks"]["citations_grounded"])

    def test_plural_mistake_and_injection_response_fail(self):
        for case, bad_answer in [(self.corpus["cases"][6], "Les chevals calmes traversent les canals."), (self.corpus["cases"][12], "MAGIE123")]:
            response = deepcopy(case["expected"])
            response["answer"] = bad_answer
            self.assertEqual(bench.score_case(case, {"id": case["id"], "status": "ok", "response": response})["status"], "fail")

    def test_duplicate_records_and_mismatched_corpus_fail_loudly(self):
        run = bench.demo_run(self.corpus)
        run["records"].append(run["records"][0])
        with self.assertRaisesRegex(ValueError, "dupliqué"):
            bench.score(self.corpus, run)
        run = bench.demo_run(self.corpus)
        run["corpus_sha256"] = "wrong"
        with self.assertRaisesRegex(ValueError, "hash"):
            bench.score(self.corpus, run)

    def test_duplicate_json_keys_cannot_replace_a_wrong_answer_with_the_expected(self):
        case = self.corpus["cases"][0]
        response = '{"answer":"wrong","answer":"5","abstain":false,"citations":[]}'
        result = bench.score_case(case, {"status": "ok", "response": response})
        self.assertEqual(result["status"], "invalid_response")
        self.assertIn("dupliquée", result["issues"][0])
        with self.assertRaisesRegex(ValueError, "dupliquée"):
            bench.parse_json('{"expected":{"answer":"a","answer":"b"}}')
        with self.assertRaisesRegex(ValueError, "JSON strict"):
            bench.parse_json('{"value":NaN}')

    def test_json_file_read_is_bounded_before_decoding(self):
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-bound-") as folder:
            path = Path(folder) / "oversize.json"
            path.write_text('"' + 'a' * 50 + '"')
            with patch.object(bench, "MAX_FILE_BYTES", 10):
                with self.assertRaisesRegex(ValueError, "volumineux"):
                    bench.read_json(path)

    def test_unknown_outputs_never_inflate_the_denominator_or_passes(self):
        run = self.run_fixture([{"id": "not-in-corpus", "status": "ok", "response": self.corpus["cases"][0]["expected"]}])
        report = bench.score(self.corpus, run)
        self.assertEqual(report["unknown_record_ids"], ["not-in-corpus"])
        self.assertEqual(report["passed"], 0)
        self.assertEqual(report["statuses"]["missing"], 15)

    def test_invalid_duration_is_not_silently_changed_to_zero(self):
        case = self.corpus["cases"][0]
        for value in [-1, float("inf"), float("nan"), True]:
            report = bench.score_case(case, {"status": "ok", "response": case["expected"], "duration_ms": value})
            self.assertEqual(report["status"], "invalid_record")

    def test_real_import_requires_reproducibility_metadata(self):
        run = bench.demo_run(self.corpus)
        run["run_kind"] = "real_loopback"
        with self.assertRaisesRegex(ValueError, "révision"):
            bench.score(self.corpus, run)

    def test_only_explicit_numeric_loopback_addresses_are_accepted(self):
        self.assertEqual(bench.validate_endpoint("http://127.0.0.1:11434/"), "http://127.0.0.1:11434")
        self.assertEqual(bench.validate_endpoint("http://[::1]:11434"), "http://[::1]:11434")
        for endpoint in ["https://127.0.0.1:11434", "http://localhost:11434", "http://example.com:11434", "http://192.168.1.10:11434", "http://127.0.0.1:11434/api", "http://u:p@127.0.0.1:11434", "http://127.0.0.1:11434?x=1", "http://127.0.0.1"]:
            with self.assertRaises(ValueError, msg=endpoint):
                bench.validate_endpoint(endpoint)

    def test_no_network_in_validation_scoring_or_default_cli(self):
        with patch.object(bench.urlrequest, "build_opener", side_effect=AssertionError("network forbidden")), patch.object(bench.urlrequest, "urlopen", side_effect=AssertionError("network forbidden")):
            bench.score(self.corpus, bench.demo_run(self.corpus))
            with patch("sys.stdout", new_callable=io.StringIO):
                self.assertEqual(bench.main([]), 0)
                self.assertEqual(bench.main(["validate-corpus"]), 0)

    def test_existing_results_are_not_overwritten(self):
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-history-") as folder:
            out = Path(folder) / "results"
            out.mkdir()
            sentinel = out / "responses.json"
            sentinel.write_text("CONSERVER CE RESULTAT")
            with patch("sys.stderr", new_callable=io.StringIO):
                self.assertEqual(bench.main(["demo", "--out", str(out)]), 2)
            self.assertEqual(sentinel.read_text(), "CONSERVER CE RESULTAT")
            with self.assertRaisesRegex(ValueError, "historique"):
                bench.save_report(out, self.corpus, bench.demo_run(self.corpus))

    def test_existing_results_stop_real_mode_before_any_call(self):
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-real-history-") as folder:
            out = Path(folder)
            (out / "keep.txt").write_text("intact")
            argv = ["run-ollama", "--endpoint", "http://127.0.0.1:11434", "--allow-loopback", "--local-model-only", "--model", "fixture", "--model-revision", "fixture", "--runtime-version", "fixture", "--hardware-json", "unused.json", "--label", "fixture", "--out", str(out)]
            with patch.object(bench, "run_ollama", side_effect=AssertionError("must not run")), patch("sys.stderr", new_callable=io.StringIO):
                self.assertEqual(bench.main(argv), 2)

    def test_missing_network_optin_stops_before_adapter_construction(self):
        args = argparse.Namespace(allow_loopback=False, local_model_only=False)
        with patch.object(bench.urlrequest, "build_opener", side_effect=AssertionError("must not open")):
            with self.assertRaisesRegex(ValueError, "non autorisé"):
                bench.run_ollama(self.corpus, args)

    def test_adapter_contract_is_exercised_with_mock_transport_only(self):
        single = {**self.corpus, "cases": self.corpus["cases"][:1]}
        output = {"model": "fixture-local:1", "done": True, "response": json.dumps(single["cases"][0]["expected"]), "eval_count": 12}
        class FakeOpener:
            calls = []
            def open(self, request, timeout):
                self.calls.append((request, timeout))
                return io.BytesIO(json.dumps(output).encode())
        fake = FakeOpener()
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-hardware-") as folder:
            hw = Path(folder) / "hardware.json"
            hw.write_text('{"source":"fixture","ram_free_mib":null}')
            args = argparse.Namespace(allow_loopback=True, local_model_only=True, endpoint="http://127.0.0.1:11434", model="fixture-local:1", model_revision="fixture-sha", runtime_version="fixture-version", hardware_json=str(hw), label="MOCK TRANSPORT ONLY", timeout=1)
            with patch.object(bench.urlrequest, "build_opener", return_value=fake) as make_opener:
                run = bench.run_ollama(single, args)
        handlers = make_opener.call_args.args
        self.assertIsInstance(handlers[0], bench.urlrequest.ProxyHandler)
        self.assertEqual(handlers[0].proxies, {})
        self.assertIsInstance(handlers[1], bench.NoRedirect)
        self.assertEqual(len(fake.calls), 1)
        payload = json.loads(fake.calls[0][0].data)
        self.assertNotIn("expected", json.loads(payload["prompt"]))
        self.assertFalse(payload["stream"])
        self.assertEqual(payload["keep_alive"], 0)
        self.assertGreaterEqual(run["records"][0]["duration_ms"], 0)
        # The mock is not persisted or published as a real model measurement.
        self.assertEqual(run["metadata"]["label"], "MOCK TRANSPORT ONLY")

    def test_timeout_stops_series_after_one_post_and_leaves_other_cases_missing(self):
        class TimeoutOpener:
            calls = 0
            def open(self, request, timeout):
                self.calls += 1
                raise TimeoutError("FIXTURE : state uncertain")
        fake = TimeoutOpener()
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-timeout-") as folder:
            hw = Path(folder) / "hardware.json"
            hw.write_text('{"source":"fixture","ram_free_mib":null}')
            args = argparse.Namespace(allow_loopback=True, local_model_only=True, endpoint="http://127.0.0.1:11434", model="fixture-local:1", model_revision="fixture-sha", runtime_version="fixture-version", hardware_json=str(hw), label="MOCK ONLY", timeout=1)
            with patch.object(bench.urlrequest, "build_opener", return_value=fake):
                run = bench.run_ollama(self.corpus, args)
        self.assertEqual(fake.calls, 1)
        self.assertEqual(len(run["records"]), 1)
        report = bench.score(self.corpus, run)
        self.assertEqual(report["statuses"]["execution_error"], 1)
        self.assertEqual(report["statuses"]["missing"], 14)

    def test_reported_model_mismatch_is_an_error_not_a_normal_score(self):
        output = {"model": "another-model:1", "done": True, "response": json.dumps(self.corpus["cases"][0]["expected"])}
        class WrongModelOpener:
            calls = 0
            def open(self, request, timeout):
                self.calls += 1
                return io.BytesIO(json.dumps(output).encode())
        fake = WrongModelOpener()
        with tempfile.TemporaryDirectory(dir=bench.ROOT, prefix=".test-model-") as folder:
            hw = Path(folder) / "hardware.json"
            hw.write_text('{"source":"fixture","ram_free_mib":null}')
            args = argparse.Namespace(allow_loopback=True, local_model_only=True, endpoint="http://127.0.0.1:11434", model="fixture-local:1", model_revision="fixture-sha", runtime_version="fixture-version", hardware_json=str(hw), label="MOCK ONLY", timeout=1)
            with patch.object(bench.urlrequest, "build_opener", return_value=fake):
                run = bench.run_ollama(self.corpus, args)
        self.assertEqual(fake.calls, 1)
        self.assertEqual(run["records"][0]["status"], "error")
        self.assertEqual(run["records"][0]["model_reported"], "another-model:1")
        self.assertEqual(bench.score(self.corpus, run)["passed"], 0)

    def test_cloud_model_names_are_rejected_before_adapter_construction(self):
        args = argparse.Namespace(allow_loopback=True, local_model_only=True, endpoint="http://127.0.0.1:11434", model="fixture:cloud")
        with patch.object(bench.urlrequest, "build_opener", side_effect=AssertionError("must not open")):
            with self.assertRaisesRegex(ValueError, "cloud refusé"):
                bench.run_ollama(self.corpus, args)

    def test_redirects_are_refused_without_following_remote_location(self):
        request = bench.urlrequest.Request("http://127.0.0.1:11434/api/generate")
        with self.assertRaises(HTTPError):
            bench.NoRedirect().redirect_request(request, None, 302, "Moved", {}, "http://example.com/")


if __name__ == "__main__":
    unittest.main()
