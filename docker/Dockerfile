FROM ubuntu:latest

WORKDIR /root
ARG TZ=Etc/UTC
#ARG DEBIAN_FRONTEND=noninteractive

# Update to latest libraries
RUN apt update && apt upgrade -y
RUN apt install -y tzdata

# Install libraries needed for the operation
RUN apt install -y build-essential \
	nodejs \
	npm \
	libmicrohttpd-dev \
	libjansson-dev \
	libssl-dev \
	libsofia-sip-ua-dev \
	libglib2.0-dev \
	libopus-dev \
	libogg-dev \
	libcurl4-openssl-dev \
	liblua5.3-dev \
	libconfig-dev \
	pkg-config \
	gengetopt \
	libtool \
	automake \
	wget \
	git \
	make \
	cmake \
	meson

# Install libnice from source
RUN git clone https://gitlab.freedesktop.org/libnice/libnice && \
	cd libnice && \
	meson --prefix=/usr build && \
	ninja -C build && \
	ninja -C build install && \
	cd ..

# Install libsrtp
RUN wget https://github.com/cisco/libsrtp/archive/v2.4.2.tar.gz && \
	tar xfv v2.4.2.tar.gz && \
	cd libsrtp-2.4.2 && \
	./configure --prefix=/usr --enable-openssl && \
	make shared_library && \
	make install && \
	cd ..

# Install usrsctp
RUN git clone https://github.com/sctplab/usrsctp && \
	cd usrsctp && \
	./bootstrap && \
	./configure --prefix=/usr --disable-programs --disable-inet --disable-inet6 && \
	make && \
	make install && \
	cd ..

# Install libwebsockets
RUN git clone https://libwebsockets.org/repo/libwebsockets && \
	cd libwebsockets && \
	git checkout v4.3-stable && \
	mkdir build && \
	cd build && \
	cmake -DLWS_MAX_SMP=1 -DLWS_WITHOUT_EXTENSIONS=0 -DCMAKE_INSTALL_PREFIX:PATH=/usr -DCMAKE_C_FLAGS="-fpic" .. && \
	make && \
	make install && \
	cd ..

# Instal MQTT client
RUN git clone https://github.com/eclipse/paho.mqtt.c.git && \
	cd paho.mqtt.c && \
	make && \
	prefix=/usr make install && \
	cd ..

# Install nanomsg
RUN apt install -y libnanomsg-dev

# Install RabbitMQ
RUN git clone https://github.com/alanxz/rabbitmq-c && \
	cd rabbitmq-c && \
	git submodule init && \
	git submodule update && \
	mkdir build && \
	cd build && \
	cmake -DCMAKE_INSTALL_PREFIX=/usr --libdir=/usr/lib64 .. && \
	make && \
	make install && \
	cd ..

# Install remaining libraries
RUN apt install -y doxygen graphviz

# Compile Janus
ARG PKG_CONFIG_PATH=/usr/lib64/pkgconfig
RUN git clone https://github.com/meetecho/janus-gateway.git && \
	cd janus-gateway && \
	sh autogen.sh && \
	./configure --prefix=/opt/janus --enable-docs --enable-all-js-modules && \
	make && \
	make install && \
	make configs

COPY ./*.jcfg /opt/janus/etc/janus/

# Install nginx
RUN apt install nginx -y
COPY ./nginx.conf /etc/nginx/nginx.conf

# Copy docs to janus folder
RUN cd /opt/janus/share && \
	rm -r ./janus/demos/docs/* && \
	cp -r ./doc/janus-gateway/janus-gateway-0.11.7/html/* ./janus/demos/docs

# Finalize
EXPOSE 80
EXPOSE 8000
EXPOSE 8088
EXPOSE 8089
EXPOSE 8188
EXPOSE 8889
EXPOSE 7088
EXPOSE 7099
EXPOSE 10000-10200/udp

CMD service nginx restart && /opt/janus/bin/janus --nat-1-1=${DOCKER_IP}