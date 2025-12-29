#!/bin/bash
cd ~/Documents/ComfyUI
eval "$(pyenv init -)"
pyenv local 3.10.6
python main.py --enable-cors-header
