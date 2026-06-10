#include "maet/indicators.hpp"

#include <algorithm>
#include <cmath>
#include <limits>
#include <numeric>
#include <stdexcept>

#include "maet/errors.hpp"

namespace maet {
namespace {

double nan_value() {
    return std::numeric_limits<double>::quiet_NaN();
}

std::vector<double> make_nan_vector(std::size_t n) {
    return std::vector<double>(n, nan_value());
}

bool is_nan(double value) {
    return std::isnan(value);
}

double window_stddev_population(
    const std::vector<double>& values,
    std::size_t start,
    std::size_t period,
    double mean
) {
    // Population variance (divide by N) intentionally used here.
    // Bollinger Bands classically uses population stddev; this matches
    // the Python fallback and the way every charting library renders BB.
    double variance_sum = 0.0;
    for (std::size_t i = start; i < start + period; ++i) {
        const double diff = values[i] - mean;
        variance_sum += diff * diff;
    }
    return std::sqrt(variance_sum / static_cast<double>(period));
}

}  // namespace

std::vector<double> sma(const std::vector<double>& values, int period) {
    validate_period(period, "SMA");
    validate_input_length(values.size(), "SMA");
    if (values.empty()) {
        return {};
    }

    const auto window = static_cast<std::size_t>(period);
    auto output = make_nan_vector(values.size());
    double rolling_sum = 0.0;
    int nan_count = 0;

    for (std::size_t i = 0; i < values.size(); ++i) {
        if (is_nan(values[i])) {
            ++nan_count;
        } else {
            rolling_sum += values[i];
        }

        if (i >= window) {
            const double outgoing = values[i - window];
            if (is_nan(outgoing)) {
                --nan_count;
            } else {
                rolling_sum -= outgoing;
            }
        }

        if (i + 1 >= window && nan_count == 0) {
            output[i] = rolling_sum / static_cast<double>(period);
        }
    }

    return output;
}

std::vector<double> ema(const std::vector<double>& values, int period) {
    validate_period(period, "EMA");
    validate_input_length(values.size(), "EMA");
    if (values.empty()) {
        return {};
    }

    const auto window = static_cast<std::size_t>(period);
    auto output = make_nan_vector(values.size());
    double rolling_sum = 0.0;
    int nan_count = 0;
    bool seeded = false;
    double previous_ema = nan_value();
    const double multiplier = 2.0 / (static_cast<double>(period) + 1.0);

    for (std::size_t i = 0; i < values.size(); ++i) {
        if (is_nan(values[i])) {
            ++nan_count;
            seeded = false;
        } else {
            rolling_sum += values[i];
        }

        if (i >= window) {
            const double outgoing = values[i - window];
            if (is_nan(outgoing)) {
                --nan_count;
            } else {
                rolling_sum -= outgoing;
            }
        }

        if (!seeded) {
            if (i + 1 >= window && nan_count == 0) {
                previous_ema = rolling_sum / static_cast<double>(period);
                output[i] = previous_ema;
                seeded = true;
            }
            continue;
        }

        if (!is_nan(values[i])) {
            previous_ema = ((values[i] - previous_ema) * multiplier) + previous_ema;
            output[i] = previous_ema;
        }
    }

    return output;
}

std::vector<double> rsi(const std::vector<double>& close, int period) {
    validate_period(period, "RSI");
    validate_input_length(close.size(), "RSI");
    if (close.empty()) {
        return {};
    }

    auto output = make_nan_vector(close.size());
    if (close.size() <= static_cast<std::size_t>(period)) {
        return output;
    }

    double gain_sum = 0.0;
    double loss_sum = 0.0;
    for (int i = 1; i <= period; ++i) {
        const double prev = close[static_cast<std::size_t>(i - 1)];
        const double cur = close[static_cast<std::size_t>(i)];
        // Treat NaN changes as zero so a single missing input does not poison
        // every subsequent RSI value.
        if (is_nan(prev) || is_nan(cur)) {
            continue;
        }
        const double change = cur - prev;
        if (change > 0.0) {
            gain_sum += change;
        } else {
            loss_sum += -change;
        }
    }

    double avg_gain = gain_sum / static_cast<double>(period);
    double avg_loss = loss_sum / static_cast<double>(period);

    auto rsi_from_averages = [](double gain, double loss) {
        if (loss == 0.0 && gain > 0.0) {
            return 100.0;
        }
        if (gain == 0.0 && loss > 0.0) {
            return 0.0;
        }
        if (gain == 0.0 && loss == 0.0) {
            return 50.0;
        }
        const double relative_strength = gain / loss;
        return 100.0 - (100.0 / (1.0 + relative_strength));
    };

    output[static_cast<std::size_t>(period)] = rsi_from_averages(avg_gain, avg_loss);

    for (std::size_t i = static_cast<std::size_t>(period) + 1; i < close.size(); ++i) {
        const double prev = close[i - 1];
        const double cur = close[i];
        if (is_nan(prev) || is_nan(cur)) {
            output[i] = nan_value();
            continue;
        }
        const double change = cur - prev;
        const double gain = change > 0.0 ? change : 0.0;
        const double loss = change < 0.0 ? -change : 0.0;
        avg_gain = ((avg_gain * static_cast<double>(period - 1)) + gain) / static_cast<double>(period);
        avg_loss = ((avg_loss * static_cast<double>(period - 1)) + loss) / static_cast<double>(period);
        output[i] = rsi_from_averages(avg_gain, avg_loss);
    }

    return output;
}

MacdResult macd(
    const std::vector<double>& close,
    int fast_period,
    int slow_period,
    int signal_period
) {
    validate_period(fast_period, "MACD fast");
    validate_period(slow_period, "MACD slow");
    validate_period(signal_period, "MACD signal");
    validate_input_length(close.size(), "MACD");
    if (fast_period >= slow_period) {
        throw std::invalid_argument("MACD fast period must be < slow period");
    }
    if (close.empty()) {
        return {{}, {}, {}};
    }

    const auto fast = ema(close, fast_period);
    const auto slow = ema(close, slow_period);
    auto macd_line = make_nan_vector(close.size());

    for (std::size_t i = 0; i < close.size(); ++i) {
        if (!is_nan(fast[i]) && !is_nan(slow[i])) {
            macd_line[i] = fast[i] - slow[i];
        }
    }

    auto signal_line = ema(macd_line, signal_period);
    auto histogram = make_nan_vector(close.size());
    for (std::size_t i = 0; i < close.size(); ++i) {
        if (!is_nan(macd_line[i]) && !is_nan(signal_line[i])) {
            histogram[i] = macd_line[i] - signal_line[i];
        }
    }

    return {macd_line, signal_line, histogram};
}

std::vector<double> atr(const std::vector<Candle>& candles, int period) {
    validate_period(period, "ATR");
    validate_input_length(candles.size(), "ATR");
    if (candles.empty()) {
        return {};
    }

    std::vector<double> true_ranges(candles.size(), nan_value());
    for (std::size_t i = 0; i < candles.size(); ++i) {
        const double high_low = candles[i].high - candles[i].low;
        if (i == 0) {
            true_ranges[i] = high_low;
            continue;
        }
        const double high_prev_close = std::abs(candles[i].high - candles[i - 1].close);
        const double low_prev_close = std::abs(candles[i].low - candles[i - 1].close);
        true_ranges[i] = std::max({high_low, high_prev_close, low_prev_close});
    }

    auto output = make_nan_vector(candles.size());
    if (candles.size() < static_cast<std::size_t>(period)) {
        return output;
    }

    double tr_sum = 0.0;
    for (int i = 0; i < period; ++i) {
        tr_sum += true_ranges[static_cast<std::size_t>(i)];
    }
    double previous_atr = tr_sum / static_cast<double>(period);
    output[static_cast<std::size_t>(period - 1)] = previous_atr;

    for (std::size_t i = static_cast<std::size_t>(period); i < candles.size(); ++i) {
        previous_atr = ((previous_atr * static_cast<double>(period - 1)) + true_ranges[i]) /
                       static_cast<double>(period);
        output[i] = previous_atr;
    }

    return output;
}

std::vector<double> vwap(const std::vector<Candle>& candles) {
    validate_input_length(candles.size(), "VWAP");
    if (candles.empty()) {
        return {};
    }
    // Day boundary assumes Indian Standard Time (UTC+5:30). The 19800 second
    // offset shifts midnight UTC to ~00:30 IST, so a new day starts at 00:30
    // UTC, which corresponds to 06:00 IST of the same IST calendar day. This
    // matches the python_fallback behavior. Callers feeding non-IST data
    // should adjust their timestamps before calling.

    auto output = make_nan_vector(candles.size());
    double cumulative_price_volume = 0.0;
    double cumulative_volume = 0.0;
    long long last_day = -1;
    for (std::size_t i = 0; i < candles.size(); ++i) {
        if (candles[i].time > 0) {
            long long ts = candles[i].time;
            if (ts > 5000000000LL) {
                ts /= 1000LL;
            }
            long long current_day = (ts + 19800) / 86400;
            if (last_day != -1 && current_day != last_day) {
                cumulative_price_volume = 0.0;
                cumulative_volume = 0.0;
            }
            last_day = current_day;
        }

        const double typical_price = (candles[i].high + candles[i].low + candles[i].close) / 3.0;
        cumulative_price_volume += typical_price * candles[i].volume;
        cumulative_volume += candles[i].volume;
        if (cumulative_volume != 0.0) {
            output[i] = cumulative_price_volume / cumulative_volume;
        }
    }

    return output;
}

BollingerBands bollinger_bands(
    const std::vector<double>& close,
    int period,
    double stddev_multiplier
) {
    validate_period(period, "Bollinger Bands");
    validate_input_length(close.size(), "Bollinger Bands");
    if (stddev_multiplier <= 0.0) {
        throw std::invalid_argument("Bollinger Bands stddev multiplier must be > 0");
    }
    if (close.empty()) {
        return {{}, {}, {}};
    }

    auto middle = sma(close, period);
    auto upper = make_nan_vector(close.size());
    auto lower = make_nan_vector(close.size());
    const auto window = static_cast<std::size_t>(period);

    for (std::size_t i = 0; i < close.size(); ++i) {
        if (i + 1 < window || is_nan(middle[i])) {
            continue;
        }
        const std::size_t start = i + 1 - window;
        bool has_nan = false;
        for (std::size_t j = start; j <= i; ++j) {
            if (is_nan(close[j])) {
                has_nan = true;
                break;
            }
        }
        if (has_nan) {
            continue;
        }
        const double stddev = window_stddev_population(close, start, window, middle[i]);
        upper[i] = middle[i] + (stddev_multiplier * stddev);
        lower[i] = middle[i] - (stddev_multiplier * stddev);
    }

    return {middle, upper, lower};
}

}  // namespace maet
