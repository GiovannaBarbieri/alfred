from __future__ import annotations

import unittest
from pathlib import Path


class ResponseCompressionTests(unittest.TestCase):
    def test_large_api_responses_use_gzip_middleware(self) -> None:
        main_source = (
            Path(__file__).parents[1] / "app" / "main.py"
        ).read_text(encoding="utf-8")

        self.assertIn("GZipMiddleware", main_source)
        self.assertIn(
            "app.add_middleware(GZipMiddleware, minimum_size=1_000, compresslevel=5)",
            main_source,
        )


if __name__ == "__main__":
    unittest.main()
