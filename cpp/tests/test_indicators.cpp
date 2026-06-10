// MAET C++ indicator tests.
//
// This file uses a hand-rolled minimal test harness (not GoogleTest/doctest)
// because the project's primary build environments target CI (Ubuntu g++ 9+)
// and a future C++17 toolchain, where the heavyweight frameworks work fine.
// The hand-rolled harness keeps the tests portable to older MinGW toolchains
// used by some local dev machines, where <mutex>/<thread> are not fully
// implemented. Once the project requires a C++17-conformant compiler the
// tests can be migrated to doctest in a single commit.
//
// The harness does the real work the original assert()s failed to do:
//   - It runs all tests even if one fails (vs assert() which aborts).
//   - It survives -DNDEBUG, since it does not use <cassert>.
//   - It reports the failing test name and location on failure.

#include "maet/errors.hpp"
#include "maet/indicators.hpp"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <exception>
#include <iostream>
#include <limits>
#include <sstream>
#include <string>
#include <vector>

namespace {

int g_failures = 0;
int g_assertions = 0;
const char* g_current_test = "<none>";

bool is_nan(double value) {
    return std::isnan(value);
}

bool approx_equal(double a, double b, double eps = 1e-6) {
    return std::abs(a - b) <= eps;
}

std::vector<double> increasing_values(int n) {
    std::vector<double> values;
    values.reserve(static_cast<std::size_t>(n));
    for (int i = 1; i <= n; ++i) {
        values.push_back(static_cast<double>(i));
    }
    return values;
}

void report_failure(const char* file, int line, const std::string& message) {
    std::cerr << "  [FAIL] " << g_current_test << " @ " << file << ":" << line
              << "  " << message << "\n";
    ++g_failures;
}

#define REQUIRE(cond)                                                          \
    do {                                                                       \
        ++g_assertions;                                                        \
        if (!(cond)) {                                                         \
            std::ostringstream _oss;                                           \
            _oss << "REQUIRE failed: " #cond;                                  \
            ::report_failure(__FILE__, __LINE__, _oss.str());                  \
        }                                                                      \
    } while (0)

#define CHECK_THROWS_AS(expr, ExType)                                          \
    do {                                                                       \
        ++g_assertions;                                                        \
        bool _caught = false;                                                  \
        try {                                                                  \
            (void)(expr);                                                      \
        } catch (const ExType&) {                                             \
            _caught = true;                                                    \
        } catch (...) {                                                        \
        }                                                                      \
        if (!_caught) {                                                        \
            std::ostringstream _oss;                                           \
            _oss << "CHECK_THROWS_AS failed: expected " #ExType " from " #expr;\
            ::report_failure(__FILE__, __LINE__, _oss.str());                  \
        }                                                                      \
    } while (0)

}  // namespace

#define RUN_TEST(name)                                                         \
    do {                                                                       \
        g_current_test = #name;                                                \
        std::cerr << "[RUN ] " #name "\n";                                    \
        name();                                                                \
    } while (0)

static void test_sma_basic() {
    const auto result = maet::sma({1, 2, 3, 4, 5}, 3);
    REQUIRE(result.size() == 5);
    REQUIRE(is_nan(result[0]));
    REQUIRE(is_nan(result[1]));
    REQUIRE(approx_equal(result[2], 2.0));
    REQUIRE(approx_equal(result[3], 3.0));
    REQUIRE(approx_equal(result[4], 4.0));
}

static void test_ema_basic() {
    const auto result = maet::ema({1, 2, 3, 4, 5, 6}, 3);
    REQUIRE(result.size() == 6);
    REQUIRE(is_nan(result[0]));
    REQUIRE(is_nan(result[1]));
    REQUIRE(approx_equal(result[2], 2.0));
    REQUIRE(!is_nan(result[5]));
}

static void test_rsi_rising_market() {
    const auto result = maet::rsi(increasing_values(30), 14);
    REQUIRE(result.size() == 30);
    for (std::size_t i = 0; i < 14; ++i) {
        REQUIRE(is_nan(result[i]));
    }
    REQUIRE(result.back() > 99.0);
}

static void test_rsi_flat_market() {
    const std::vector<double> close(30, 100.0);
    const auto result = maet::rsi(close, 14);
    REQUIRE(result.size() == 30);
    REQUIRE(approx_equal(result.back(), 50.0));
}

static void test_rsi_handles_nan_input() {
    auto values = increasing_values(30);
    values[5] = std::numeric_limits<double>::quiet_NaN();
    const auto result = maet::rsi(values, 14);
    REQUIRE(result.size() == 30);
    // Regression: a single NaN must not poison all later RSI values.
    REQUIRE(!is_nan(result[20]));
    REQUIRE(result[20] > 0.0);
    REQUIRE(result[20] <= 100.0);
}

static void test_macd_shape() {
    const auto close = increasing_values(60);
    const auto result = maet::macd(close);
    REQUIRE(result.macd.size() == close.size());
    REQUIRE(result.signal.size() == close.size());
    REQUIRE(result.histogram.size() == close.size());
    for (std::size_t i = 0; i < 25; ++i) {
        REQUIRE(is_nan(result.macd[i]));
    }
    REQUIRE(is_nan(result.signal[25]));
    REQUIRE(!is_nan(result.macd.back()));
    REQUIRE(!is_nan(result.signal.back()));
    REQUIRE(!is_nan(result.histogram.back()));
}

static void test_atr_basic() {
    // First true range = high - low (Wilder convention). This matches
    // TA-Lib, TradingView, and StockCharts.com.
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 100},
        {9, 11, 8, 10, 120},
        {10, 12, 9, 11, 130},
        {11, 13, 10, 12, 140},
        {12, 14, 11, 13, 150},
    };
    const auto result = maet::atr(candles, 3);
    REQUIRE(result.size() == candles.size());
    for (std::size_t i = 0; i < 2; ++i) {
        REQUIRE(is_nan(result[i]));
    }
    REQUIRE(!is_nan(result[2]));
    REQUIRE(!is_nan(result[4]));
}

static void test_vwap_basic() {
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 100},
        {11, 12, 10, 11, 100},
    };
    const auto result = maet::vwap(candles);
    REQUIRE(result.size() == candles.size());
    REQUIRE(approx_equal(result[0], 9.0));
    REQUIRE(approx_equal(result[1], 10.0));
}

static void test_vwap_zero_volume_outputs_nan() {
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 0},
    };
    const auto result = maet::vwap(candles);
    REQUIRE(result.size() == candles.size());
    REQUIRE(is_nan(result[0]));
}

static void test_vwap_daily_reset() {
    const std::vector<maet::Candle> seconds_candles = {
        {9, 10, 8, 9, 100, 1716710400},
        {11, 12, 10, 11, 100, 1716796800},
    };
    const auto seconds_result = maet::vwap(seconds_candles);
    REQUIRE(approx_equal(seconds_result[0], 9.0));
    REQUIRE(approx_equal(seconds_result[1], 11.0));

    const std::vector<maet::Candle> ms_candles = {
        {9, 10, 8, 9, 100, 1716710400000LL},
        {11, 12, 10, 11, 100, 1716796800000LL},
    };
    const auto ms_result = maet::vwap(ms_candles);
    REQUIRE(approx_equal(ms_result[0], 9.0));
    REQUIRE(approx_equal(ms_result[1], 11.0));
}

static void test_bollinger_basic() {
    const auto result = maet::bollinger_bands({1, 2, 3, 4, 5}, 3);
    REQUIRE(result.middle.size() == 5);
    REQUIRE(result.upper.size() == 5);
    REQUIRE(result.lower.size() == 5);
    REQUIRE(approx_equal(result.middle[2], 2.0));
    REQUIRE(result.upper[2] > result.middle[2]);
    REQUIRE(result.lower[2] < result.middle[2]);
}

static void test_empty_input() {
    REQUIRE(maet::sma({}, 3).empty());
    REQUIRE(maet::ema({}, 3).empty());
    REQUIRE(maet::rsi({}, 14).empty());
    const auto macd_result = maet::macd({});
    REQUIRE(macd_result.macd.empty());
    REQUIRE(macd_result.signal.empty());
    REQUIRE(macd_result.histogram.empty());
    REQUIRE(maet::atr({}, 14).empty());
    REQUIRE(maet::vwap({}).empty());
    const auto bands = maet::bollinger_bands({}, 20);
    REQUIRE(bands.middle.empty());
    REQUIRE(bands.upper.empty());
    REQUIRE(bands.lower.empty());
}

static void test_invalid_parameters() {
    CHECK_THROWS_AS(maet::sma({1, 2, 3}, 0), std::invalid_argument);
    CHECK_THROWS_AS(maet::ema({1, 2, 3}, -1), std::invalid_argument);
    CHECK_THROWS_AS(maet::rsi({1, 2, 3}, 0), std::invalid_argument);
    CHECK_THROWS_AS(maet::atr({{1, 2, 0, 1, 10}}, 0), std::invalid_argument);
    CHECK_THROWS_AS(maet::macd({1, 2, 3}, 12, 12, 9), std::invalid_argument);
    CHECK_THROWS_AS(maet::bollinger_bands({1, 2, 3}, 3, 0.0), std::invalid_argument);
}

static void test_oversize_input_rejected() {
    const std::size_t big = maet::MAX_INPUT_LENGTH + 1;
    std::vector<double> large(big, 1.0);
    CHECK_THROWS_AS(maet::sma(large, 5), std::invalid_argument);
    CHECK_THROWS_AS(maet::ema(large, 5), std::invalid_argument);
    CHECK_THROWS_AS(maet::rsi(large, 5), std::invalid_argument);
    CHECK_THROWS_AS(maet::macd(large), std::invalid_argument);
    CHECK_THROWS_AS(maet::bollinger_bands(large, 5, 2.0), std::invalid_argument);
    std::vector<maet::Candle> large_candles(big, {1, 2, 0, 1, 10});
    CHECK_THROWS_AS(maet::atr(large_candles, 5), std::invalid_argument);
    CHECK_THROWS_AS(maet::vwap(large_candles), std::invalid_argument);
}

static void test_max_input_length_constant() {
    // The Python test suite uses this constant. If you change it here,
    // update the matching test in tests/test_indicator_engine.py.
    REQUIRE(maet::MAX_INPUT_LENGTH == 100000);
}

int main() {
    RUN_TEST(test_sma_basic);
    RUN_TEST(test_ema_basic);
    RUN_TEST(test_rsi_rising_market);
    RUN_TEST(test_rsi_flat_market);
    RUN_TEST(test_rsi_handles_nan_input);
    RUN_TEST(test_macd_shape);
    RUN_TEST(test_atr_basic);
    RUN_TEST(test_vwap_basic);
    RUN_TEST(test_vwap_zero_volume_outputs_nan);
    RUN_TEST(test_vwap_daily_reset);
    RUN_TEST(test_bollinger_basic);
    RUN_TEST(test_empty_input);
    RUN_TEST(test_invalid_parameters);
    RUN_TEST(test_oversize_input_rejected);
    RUN_TEST(test_max_input_length_constant);

    std::cerr << "\n";
    if (g_failures == 0) {
        std::cerr << "All C++ indicator tests passed (" << g_assertions
                  << " assertions)\n";
        return 0;
    }
    std::cerr << g_failures << " / " << g_assertions
              << " assertions failed\n";
    return 1;
}
