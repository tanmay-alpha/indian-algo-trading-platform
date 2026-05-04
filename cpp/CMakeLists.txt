cmake_minimum_required(VERSION 3.15)

project(maet_indicators VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_library(maet_indicators STATIC
    src/indicators.cpp
)

target_include_directories(maet_indicators
    PUBLIC
        ${CMAKE_CURRENT_SOURCE_DIR}/include
)

if(MSVC)
    target_compile_options(maet_indicators PRIVATE /W4)
else()
    target_compile_options(maet_indicators PRIVATE -Wall -Wextra -Wpedantic)
endif()

add_executable(maet_indicator_tests
    tests/test_indicators.cpp
)

target_link_libraries(maet_indicator_tests
    PRIVATE
        maet_indicators
)
