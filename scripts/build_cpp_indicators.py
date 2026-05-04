import os
import platform
import shutil
import subprocess
import sys
from pathlib import Path


def main() -> int:
    repo_root = Path(__file__).resolve().parents[1]
    cpp_dir = repo_root / "cpp"
    build_dir = cpp_dir / "build"

    cmake = shutil.which("cmake")
    if cmake is None:
        print("CMake was not found on PATH. Install CMake, then rerun this script.")
        return 1

    env = os.environ.copy()
    _add_pybind11_cmake_dir(env)

    commands = [
        [cmake, "-S", str(cpp_dir), "-B", str(build_dir)],
        [cmake, "--build", str(build_dir), "--config", "Release"],
    ]

    for command in commands:
        print("Running:", " ".join(command))
        completed = subprocess.run(command, cwd=repo_root, env=env)
        if completed.returncode != 0:
            return completed.returncode

    print(f"C++ indicator build complete for {platform.system()}.")
    print(f"Build directory: {build_dir}")
    print("If pybind11 was available to CMake, maet_cpp_indicators was built there.")
    return 0


def _add_pybind11_cmake_dir(env: dict[str, str]) -> None:
    try:
        completed = subprocess.run(
            [sys.executable, "-m", "pybind11", "--cmakedir"],
            check=True,
            capture_output=True,
            text=True,
        )
    except Exception:
        return

    cmake_dir = completed.stdout.strip()
    if not cmake_dir:
        return

    existing = env.get("CMAKE_PREFIX_PATH")
    env["CMAKE_PREFIX_PATH"] = cmake_dir if not existing else f"{cmake_dir}{os.pathsep}{existing}"


if __name__ == "__main__":
    raise SystemExit(main())
