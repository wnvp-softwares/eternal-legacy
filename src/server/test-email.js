require('dotenv').config();

const {Resend}=require('resend');

const resend=new Resend(process.env.RESEND_API_KEY);


(async()=>{

const result=await resend.emails.send({
    from:process.env.EMAIL_FROM,
    to:"wnvp115@gmail.com",
    subject:"Prueba Legacy",
    html:"<h1>Funcionando con Resend 🚀</h1>"
});


console.log(result);

})();