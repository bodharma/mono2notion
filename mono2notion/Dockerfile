FROM public.ecr.aws/lambda/nodejs:18

WORKDIR /var/task

COPY package*.json ./
RUN npm install

COPY . .

CMD ["index.handler"]
