import React from 'react';
import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';
import 'isomorphic-unfetch';
import clientCredentials from '../credentials/client';
import Link from 'next/link';
import Head from '../components/head';
import Nav from '../components/nav';

const List = ({ text, handleDelete }) => {
  return (
    <li>
      <label>
        {text}
      </label>
      <button onClick={handleDelete}>[Delete]</button>
    </li>
  );
};

export default class Home extends React.Component {
  static async getInitialProps ({ req, query }) {
    const user = req && req.session ? req.session.decodedToken : null;
    // don't fetch anything from firebase if the user is not found
    // const snap = user && await req.firebaseServer.database().ref('messages').once('value');
    // const messages = snap && snap.val();
    const messages = null;
    return { user, messages };
  }

  constructor (props) {
    super(props);

    this.state = {
      user: this.props.user,
      value: '',
      messages: this.props.messages,
    }

    this.addDbListener = this.addDbListener.bind(this);
    this.removeDbListener = this.removeDbListener.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
    this.handleDelete = this.handleDelete.bind(this);
  }

  componentDidMount () {
    firebase.initializeApp(clientCredentials);

    if (this.state.user) this.addDbListener();

    firebase.auth().onAuthStateChanged(user => {
      if (user) {
        this.setState({ user: user });

        return user
          .getIdToken()
          .then(token => {
            // eslint-disable-next-line no-undef
            return fetch('/api/login', {
              method: 'POST',
              // eslint-disable-next-line no-undef
              headers: new Headers({ 'Content-Type': 'application/json' }),
              credentials: 'same-origin',
              body: JSON.stringify({ token }),
            })
          })
          .then(res => this.addDbListener());
      } else {
        this.setState({ user: null });
        // eslint-disable-next-line no-undef
        fetch('/api/logout', {
          method: 'POST',
          credentials: 'same-origin'
        }).then(() => this.removeDbListener());
      }
    });
  }

  addDbListener () {
    var db = firebase.firestore();

    let unsubscribe = db.collection('messages').onSnapshot(
      querySnapshot => {
        var messages = new Map();

        querySnapshot.forEach(function (doc) {
          messages.set(doc.id, doc);
        });

        if (messages) this.setState({ messages });
      },
      error => {
        console.error(error);
      }
    );

    this.setState({ unsubscribe });
  }

  removeDbListener () {
    // firebase.database().ref('messages').off();
    if (this.state.unsubscribe) {
      this.state.unsubscribe();
    }
  }

  handleChange (event) {
    this.setState({ value: event.target.value });
  }

  handleSubmit(event) {
    event.preventDefault();

    var db = firebase.firestore();
    const date = new Date().getTime();

    db.collection('messages')
      .doc(`${date}`)
      .set({
        id: date,
        text: this.state.value,
      });

    this.setState({ value: '' });
  }

  handleLogin () {
    firebase.auth().signInWithPopup(new firebase.auth.GoogleAuthProvider());
  }

  handleLogout () {
    firebase.auth().signOut();
  }

  handleDelete(doc) {
    if (!confirm('Are you OK?')) return;

    // Delete on firestore
    doc.ref.delete();

    // Delete on local state
    const messages = Object.assign(new Map(), this.state.messages);
    messages.delete(doc.id);

    this.setState({ messages });
  }

  render() {
    const { user, value, messages } = this.state;

    return (
      <div>
        <Head title="Home" />
        <Nav />

        <div>
          {user ? (
            <button onClick={this.handleLogout}>Logout</button>
          ) : (
            <button onClick={this.handleLogin}>Login</button>
          )}
          {user && (
            <div>
              <form onSubmit={this.handleSubmit}>
                <input
                  type={'text'}
                  onChange={this.handleChange}
                  placeholder={'add message...'}
                  value={value}
                />
              </form>
              <ul>
                {messages &&
                  Array.from(messages.keys()).map(key => (
                    <List
                      key={key}
                      text={messages.get(key).data().text}
                      handleDelete={this.handleDelete.bind(null, messages.get(key))}
                    />
                  ))}
              </ul>
            </div>
          )}
        </div>

        <div className="hero">
          <h1 className="title">Welcome to Next! Updated!</h1>
          <p className="description">
            To get started, edit <code>pages/index.js</code> and save to reload.
          </p>

          <div className="row">
            <a className="card" href="https://github.com/zeit/next.js#getting-started">
              <h3>Getting Started &rarr;</h3>
              <p>Learn more about Next on Github and in their examples</p>
            </a>
            <a className="card" href="https://open.segment.com/create-next-app">
              <h3>Examples &rarr;</h3>
              <p>
                Find other example boilerplates on the{' '}
                <code>create-next-app</code> site
              </p>
            </a>
            <a className="card" href="https://github.com/segmentio/create-next-app">
              <h3>Create Next App &rarr;</h3>
              <p>Was this tool helpful? Let us know how we can improve it</p>
            </a>
          </div>
        </div>

        <style jsx>{`
          .hero {
            width: 100%;
            color: #333;
          }
          .title {
            margin: 0;
            width: 100%;
            padding-top: 80px;
            line-height: 1.15;
            font-size: 48px;
          }
          .title,
          .description {
            text-align: center;
          }
          .row {
            max-width: 880px;
            margin: 80px auto 40px;
            display: flex;
            flex-direction: row;
            justify-content: space-around;
          }
          .card {
            padding: 18px 18px 24px;
            width: 220px;
            text-align: left;
            text-decoration: none;
            color: #434343;
            border: 1px solid #9b9b9b;
          }
          .card:hover {
            border-color: #067df7;
          }
          .card h3 {
            margin: 0;
            color: #067df7;
            font-size: 18px;
          }
          .card p {
            margin: 0;
            padding: 12px 0 0;
            font-size: 13px;
            color: #333;
          }
        `}</style>
      </div>
    );
  }
}
