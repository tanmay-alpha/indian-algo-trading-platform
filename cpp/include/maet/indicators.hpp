#pragma once

#include <vector>

#include "maet/types.hpp"

namespace maet {

std::vector<double> sma(const std::vector<double>& values, int period);

std::vector<double> ema(const std::vector<double>& values, int period);

std::vector<double> rsi(const std::vector<double>& close, int period = 14);

MacdResult macd(
    const std::vector<double>& close,
    int fast_period = 12,
    int slow_period = 26,
    int signal_period = 9
);

std::vector<double> atr(
    const std::vector<Candle>& candles,
    int period = 14
);

std::vector<double> vwap(const std::vector<Candle>& candles);

BollingerBands bollinger_bands(
    const std::vector<double>& close,
    int period = 20,
    double stddev_multiplier = 2.0
);

}  // namespace maet
