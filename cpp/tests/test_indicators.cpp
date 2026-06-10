#include "maet/indicators.hpp"
#include "maet/errors.hpp"

#include <cassert>
#include <cmath>
#include <iostream>
#include <limits>
#include <stdexcept>
#include <vector>

namespace {

bool is_nan(double value) {
    return std::isnan(value);
}

bool approx_equal(double a, double b, double eps = 1e-6) {
    return std::abs(a - b) <= eps;
}

void assert_vector_size(const std::vector<double>& values, std::size_t expected) {
    assert(values.size() == expected);
}

void assert_nan_prefix(const std::vector<double>& values, std::size_t count) {
    assert(values.size() >= count);
    for (std::size_t i = 0; i < count; ++i) {
        assert(is_nan(values[i]));
    }
}

template <typename Fn>
void assert_throws_invalid_argument(Fn&& fn) {
    bool thrown = false;
    try {
        fn();
    } catch (const std::invalid_argument&) {
        thrown = true;
    }
    assert(thrown);
}

std::vector<double> increasing_values(int n) {
    std::vector<double> values;
    values.reserve(static_cast<std::size_t>(n));
    for (int i = 1; i <= n; ++i) {
        values.push_back(static_cast<double>(i));
    }
    return values;
}

void test_sma_basic() {
    const auto result = maet::sma({1, 2, 3, 4, 5}, 3);
    assert_vector_size(result, 5);
    assert_nan_prefix(result, 2);
    assert(approx_equal(result[2], 2.0));
    assert(approx_equal(result[3], 3.0));
    assert(approx_equal(result[4], 4.0));
}

void test_ema_basic() {
    const auto result = maet::ema({1, 2, 3, 4, 5, 6}, 3);
    assert_vector_size(result, 6);
    assert_nan_prefix(result, 2);
    assert(approx_equal(result[2], 2.0));
    assert(!is_nan(result[5]));
}

void test_rsi_rising_market() {
    const auto result = maet::rsi(increasing_values(30), 14);
    assert_vector_size(result, 30);
    assert_nan_prefix(result, 14);
    assert(result.back() > 99.0);
}

void test_rsi_flat_market() {
    const std::vector<double> close(30, 100.0);
    const auto result = maet::rsi(close, 14);
    assert_vector_size(result, 30);
    assert(approx_equal(result.back(), 50.0));
}

void test_rsi_handles_nan_input() {
    // Single NaN at index 5 should not poison later values.
    auto values = increasing_values(30);
    values[5] = std::numeric_limits<double>::quiet_NaN();
    const auto result = maet::rsi(values, 14);
    assert_vector_size(result, 30);
    // Index 20 is well past the NaN; the result must be a real RSI value,
    // not NaN. For a rising market with a single missing sample, RSI is
    // still close to 100. We just assert the bug-fix invariant: not NaN,
    // in (0, 100] inclusive.
    assert(!is_nan(result[20]));
    assert(result[20] > 0.0);
    assert(result[20] <= 100.0);
}

void test_macd_shape() {
    const auto close = increasing_values(60);
    const auto result = maet::macd(close);
    assert_vector_size(result.macd, close.size());
    assert_vector_size(result.signal, close.size());
    assert_vector_size(result.histogram, close.size());
    assert_nan_prefix(result.macd, 25);
    assert(is_nan(result.signal[25]));
    assert(!is_nan(result.macd.back()));
    assert(!is_nan(result.signal.back()));
    assert(!is_nan(result.histogram.back()));
}

void test_atr_basic() {
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 100},
        {9, 11, 8, 10, 120},
        {10, 12, 9, 11, 130},
        {11, 13, 10, 12, 140},
        {12, 14, 11, 13, 150},
    };
    const auto result = maet::atr(candles, 3);
    assert_vector_size(result, candles.size());
    assert_nan_prefix(result, 2);
    assert(!is_nan(result[2]));
    assert(!is_nan(result[4]));
}

void test_vwap_basic() {
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 100},
        {11, 12, 10, 11, 100},
    };
    const auto result = maet::vwap(candles);
    assert_vector_size(result, candles.size());
    assert(approx_equal(result[0], 9.0));
    assert(approx_equal(result[1], 10.0));
}

void test_vwap_zero_volume_outputs_nan() {
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 0},
    };
    const auto result = maet::vwap(candles);
    assert_vector_size(result, candles.size());
    assert(is_nan(result[0]));
}

void test_vwap_daily_reset() {
    // Test seconds timestamps
    const std::vector<maet::Candle> candles = {
        {9, 10, 8, 9, 100, 1716710400},
        {11, 12, 10, 11, 100, 1716796800},
    };
    const auto result = maet::vwap(candles);
    assert_vector_size(result, candles.size());
    assert(approx_equal(result[0], 9.0));
    assert(approx_equal(result[1], 11.0));

    // Test millisecond timestamps
    const std::vector<maet::Candle> candles_ms = {
        {9, 10, 8, 9, 100, 1716710400000LL},
        {11, 12, 10, 11, 100, 1716796800000LL},
    };
    const auto result_ms = maet::vwap(candles_ms);
    assert_vector_size(result_ms, candles_ms.size());
    assert(approx_equal(result_ms[0], 9.0));
    assert(approx_equal(result_ms[1], 11.0));
}

void test_bollinger_basic() {
    const auto result = maet::bollinger_bands({1, 2, 3, 4, 5}, 3);
    assert_vector_size(result.middle, 5);
    assert_vector_size(result.upper, 5);
    assert_vector_size(result.lower, 5);
    assert(approx_equal(result.middle[2], 2.0));
    assert(result.upper[2] > result.middle[2]);
    assert(result.lower[2] < result.middle[2]);
}

void test_empty_input() {
    assert(maet::sma({}, 3).empty());
    assert(maet::ema({}, 3).empty());
    assert(maet::rsi({}, 14).empty());
    const auto macd_result = maet::macd({});
    assert(macd_result.macd.empty());
    assert(macd_result.signal.empty());
    assert(macd_result.histogram.empty());
    assert(maet::atr({}, 14).empty());
    assert(maet::vwap({}).empty());
    const auto bands = maet::bollinger_bands({}, 20);
    assert(bands.middle.empty());
    assert(bands.upper.empty());
    assert(bands.lower.empty());
}

void test_invalid_parameters() {
    assert_throws_invalid_argument([] { maet::sma({1, 2, 3}, 0); });
    assert_throws_invalid_argument([] { maet::ema({1, 2, 3}, -1); });
    assert_throws_invalid_argument([] { maet::rsi({1, 2, 3}, 0); });
    assert_throws_invalid_argument([] { maet::atr({{1, 2, 0, 1, 10}}, 0); });
    assert_throws_invalid_argument([] { maet::macd({1, 2, 3}, 12, 12, 9); });
    assert_throws_invalid_argument([] { maet::bollinger_bands({1, 2, 3}, 3, 0.0); });
}

void test_oversize_input_rejected() {
    const std::size_t big = maet::MAX_INPUT_LENGTH + 1;
    std::vector<double> large(big, 1.0);
    assert_throws_invalid_argument([&] { maet::sma(large, 5); });
    assert_throws_invalid_argument([&] { maet::ema(large, 5); });
    assert_throws_invalid_argument([&] { maet::rsi(large, 5); });
    assert_throws_invalid_argument([&] { maet::macd(large); });
    assert_throws_invalid_argument([&] { maet::bollinger_bands(large, 5, 2.0); });
    std::vector<maet::Candle> large_candles(big, {1, 2, 0, 1, 10});
    assert_throws_invalid_argument([&] { maet::atr(large_candles, 5); });
    assert_throws_invalid_argument([&] { maet::vwap(large_candles); });
}

}  // namespace

int main() {
    test_sma_basic();
    test_ema_basic();
    test_rsi_rising_market();
    test_rsi_flat_market();
    test_rsi_handles_nan_input();
    test_macd_shape();
    test_atr_basic();
    test_vwap_basic();
    test_vwap_zero_volume_outputs_nan();
    test_vwap_daily_reset();
    test_bollinger_basic();
    test_empty_input();
    test_invalid_parameters();
    test_oversize_input_rejected();

    std::cout << "All C++ indicator tests passed\n";
    return 0;
}
