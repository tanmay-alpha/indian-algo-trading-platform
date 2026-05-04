#pragma once

#include <stdexcept>
#include <string>
#include <vector>

namespace maet {

inline void validate_period(int period, const char* name) {
    if (period <= 0) {
        throw std::invalid_argument(std::string(name) + " period must be > 0");
    }
}

inline void validate_non_empty(const std::vector<double>& values, const char* name) {
    if (values.empty()) {
        throw std::invalid_argument(std::string(name) + " values must not be empty");
    }
}

}  // namespace maet
