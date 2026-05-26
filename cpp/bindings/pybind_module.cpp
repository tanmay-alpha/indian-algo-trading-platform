#include <stdexcept>
#include <string>
#include <vector>

#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "maet/indicators.hpp"

namespace py = pybind11;

namespace {

maet::Candle dict_to_candle(const py::dict& item) {
    static const char* required[] = {"open", "high", "low", "close", "volume"};
    for (const char* key : required) {
        if (!item.contains(key)) {
            throw std::invalid_argument(std::string("candle missing required key: ") + key);
        }
    }
    long long t_val = 0;
    if (item.contains("time")) {
        t_val = item["time"].cast<long long>();
    }
    return maet::Candle{
        item["open"].cast<double>(),
        item["high"].cast<double>(),
        item["low"].cast<double>(),
        item["close"].cast<double>(),
        item["volume"].cast<double>(),
        t_val
    };
}

std::vector<maet::Candle> parse_candles(const std::vector<py::dict>& candles) {
    std::vector<maet::Candle> parsed;
    parsed.reserve(candles.size());
    for (const auto& candle : candles) {
        parsed.push_back(dict_to_candle(candle));
    }
    return parsed;
}

py::dict macd_to_dict(const maet::MacdResult& result) {
    py::dict out;
    out["macd"] = result.macd;
    out["signal"] = result.signal;
    out["histogram"] = result.histogram;
    return out;
}

py::dict bollinger_to_dict(const maet::BollingerBands& result) {
    py::dict out;
    out["middle"] = result.middle;
    out["upper"] = result.upper;
    out["lower"] = result.lower;
    return out;
}

py::dict engine_info() {
    py::dict out;
    out["engine"] = "cpp";
    out["module"] = "maet_cpp_indicators";
    out["version"] = "0.1.0";
    out["indicators"] = std::vector<std::string>{
        "sma",
        "ema",
        "rsi",
        "macd",
        "atr",
        "vwap",
        "bollinger_bands",
    };
    return out;
}

}  // namespace

PYBIND11_MODULE(maet_cpp_indicators, m) {
    m.doc() = "MAET C++ indicator engine bindings";
    m.attr("__version__") = "0.1.0";

    m.def("sma", &maet::sma, py::arg("values"), py::arg("period"));
    m.def("ema", &maet::ema, py::arg("values"), py::arg("period"));
    m.def("rsi", &maet::rsi, py::arg("close"), py::arg("period") = 14);

    m.def(
        "macd",
        [](const std::vector<double>& close, int fast_period, int slow_period, int signal_period) {
            return macd_to_dict(maet::macd(close, fast_period, slow_period, signal_period));
        },
        py::arg("close"),
        py::arg("fast_period") = 12,
        py::arg("slow_period") = 26,
        py::arg("signal_period") = 9
    );

    m.def(
        "atr",
        [](const std::vector<py::dict>& candles, int period) {
            return maet::atr(parse_candles(candles), period);
        },
        py::arg("candles"),
        py::arg("period") = 14
    );

    m.def(
        "vwap",
        [](const std::vector<py::dict>& candles) {
            return maet::vwap(parse_candles(candles));
        },
        py::arg("candles")
    );

    m.def(
        "bollinger_bands",
        [](const std::vector<double>& close, int period, double stddev_multiplier) {
            return bollinger_to_dict(maet::bollinger_bands(close, period, stddev_multiplier));
        },
        py::arg("close"),
        py::arg("period") = 20,
        py::arg("stddev_multiplier") = 2.0
    );

    m.def("engine_info", &engine_info);
}
