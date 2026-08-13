FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY pom.xml ./pom.xml
COPY common ./common
RUN mvn -q -N install -f pom.xml
RUN mvn -q install -f common/pom.xml -DskipTests
COPY auth-service/pom.xml ./auth-service/pom.xml
COPY auth-service/src ./auth-service/src
WORKDIR /build/auth-service
RUN mvn -q package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=build /build/auth-service/target/*.jar app.jar
EXPOSE 8091
ENTRYPOINT ["java","-jar","app.jar"]