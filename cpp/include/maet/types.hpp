#pragma once

#include <string>
#include <vector>

namespace maet {

struct Candle {
    double open;
    double high;
    double low;
    double close;
    double volume;
    long long time = 0;
};

struct MacdResult {
    std::vector<double> macd;
    std::vector<double> signal;
    std::vector<double> histogram;
};

struct BollingerBands {
    std::vector<double> middle;
    std::vector<double> upper;
    std::vector<double> lower;
};

struct IndicatorResult {
    std::string name;
    std::vector<double> values;
};

}  // namespace maet
