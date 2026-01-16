FROM ubuntu:24.10

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    file \
    git \
    ca-certificates \
    openssl \
    procps \
    nodejs \
    npm \
    jq \
    && rm -rf /var/lib/apt/lists/*

RUN useradd -m -s /bin/bash vscode

RUN mkdir -p /home/linuxbrew/.linuxbrew \
    && chown -R vscode:vscode /home/linuxbrew

USER vscode
WORKDIR /home/vscode
ENV HOME=/home/vscode

RUN NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

ENV PATH="/home/linuxbrew/.linuxbrew/bin:/home/linuxbrew/.linuxbrew/sbin:$PATH"
ENV HOMEBREW_NO_AUTO_UPDATE=1

RUN brew install asdf

RUN echo '\n# Source asdf from the Homebrew path' >> ~/.bashrc \
 && echo '. /home/linuxbrew/.linuxbrew/opt/asdf/libexec/asdf.sh' >> ~/.bashrc

# install dojo
RUN asdf plugin add dojo https://github.com/dojoengine/asdf-dojo
RUN asdf install dojo 1.5.0

#install scarb
RUN asdf plugin add scarb
RUN asdf install scarb 2.10.1

# install slot
RUN curl -L https://slot.cartridge.sh | bash
RUN /home/vscode/.slot/bin/slotup

# switch to root
USER root

# install pnpm
RUN npm install -g pnpm

RUN mkdir -p /workspaces/dojodev
WORKDIR /workspaces/dojodev