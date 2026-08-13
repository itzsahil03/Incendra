FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY config-server/pom.xml ./config-server/pom.xml
COPY config-server/src ./config-server/src
WORKDIR /build/config-server
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/config-server/target/*.jar app.jar
EXPOSE 8888
ENTRYPOINT ["java","-jar","app.jar"]