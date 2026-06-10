cmake_minimum_required(VERSION 3.15)

project(maet_indicators VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# When building via CMake (not the manual g++ fallback), include the test target.
# CI uses the manual g++ build which does not need CMake.
option(MAET_BUILD_TESTS "Build the indicator tests" ON)

add_library(maet_indicators STATIC
    src/indicators.cpp
)

set_target_properties(maet_indicators PROPERTIES POSITION_INDEPENDENT_CODE ON)

target_include_directories(maet_indicators
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

if(MSVC)
    target_compile_options(maet_indicators PRIVATE /W4)
else()
    target_compile_options(maet_indicators PRIVATE -Wall -Wextra -Wpedantic)
endif()

if(MAET_BUILD_TESTS)
    enable_testing()

    add_executable(maet_indicator_tests
        tests/test_indicators.cpp
    )

    target_link_libraries(maet_indicator_tests
        PRIVATE
            maet_indicators
    )

    add_test(NAME maet_indicator_tests
        COMMAND maet_indicator_tests
        WORKING_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}
    )
endif()

find_package(pybind11 CONFIG QUIET)

if(pybind11_FOUND)
    pybind11_add_module(maet_cpp_indicators
        bindings/pybind_module.cpp
    )
    target_link_libraries(maet_cpp_indicators
        PRIVATE
            maet_indicators
    )
    target_include_directories(maet_cpp_indicators
        PRIVATE
            ${CMAKE_CURRENT_SOURCE_DIR}/include
    )
else()
    message(WARNING "pybind11 not found; Python extension will not be built")
endif()
