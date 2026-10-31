"""Regenerate design sheets from the production scene renderer.

The earlier hand-written concept generator is preserved in Git history. Keeping
one geometry source prevents reviewed keyframes and runtime animation diverging.
"""
import pathlib
import subprocess

root = pathlib.Path(__file__).resolve().parents[3]
subprocess.run(['node', 'scripts/export-scene-storyboards.mjs'], cwd=root, check=True)
