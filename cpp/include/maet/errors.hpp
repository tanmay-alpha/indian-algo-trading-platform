#pragma once

#include <cstddef>
#include <stdexcept>
#include <string>
#include <vector>

namespace maet {

// Internal input length ceiling. The HTTP layer enforces 5000, but a C++
// caller should not be able to DoS the engine with a 1B-element vector.
// `static constexpr` so the symbol has internal linkage in older toolchains
// (C++17 inline variables require GCC 7+ / Clang 3.9+).
static constexpr std::size_t MAX_INPUT_LENGTH = 100000;

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

inline void validate_input_length(std::size_t size, const char* name) {
    if (size > MAX_INPUT_LENGTH) {
        throw std::invalid_argument(
            std::string(name) + " input too large (max " +
            std::to_string(MAX_INPUT_LENGTH) + ")"
        );
    }
}

}  // namespace maet
