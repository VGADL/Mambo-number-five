# Mambo-number-five
Projeto REST API em Node.js + Express + MongoDB
Projeto Criado por:
André Pita, nº111652;
Guilherme Pereira, nº110909;
Vlad Ganta, nº110672.

Vlad Ganta: 
    No desenvolvimento do projeto, fiquei responsável por implementar os dois endpoints PUT, que permitem atualizar os dados dos utilizadores e dos eventos existentes na base de dados. Também fui eu quem desenvolveu a parte das reviews, criando o endpoint que permite aos utilizadores adicionar uma nova review a um evento. Além disso, tive a ideia e implementei o endpoint que mostra os eventos que estão a decorrer na data atual ou numa data específica indicada pelo utilizador. Estas partes envolveram trabalhar com a base de dados MongoDB, tratar e validar dados e garantir que todas as operações de escrita e atualização funcionassem corretamente.

André Pita:
    Durante o desenvolvimento deste projeto, fui responsável pela implementação dos principais endpoints da API, tanto na vertente de eventos como na de utilizadores.
    Implementei os métodos POST para inserção de novos registos e os GET com paginação, garantindo eficiência e consistência no acesso aos dados.
    Criei ainda um endpoint para o novo parâmetro favorites[], permitindo aos utilizadores gerir os seus eventos favoritos através dos métodos POST, GET e DELETE.
    Por fim, adaptei o dataset inicial, removendo o campo _id automático do MongoDB e substituindo-o por um identificador numérico personalizado, assegurando maior coerência entre os dados.
